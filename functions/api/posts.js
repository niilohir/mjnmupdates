// MJNM UPDATES API — runs on Cloudflare Pages Functions.
//   GET  /api/posts  -> { posts, team }: latest posts, newest first, plus the
//                       list of names and colors (public)
//   POST /api/posts  -> multipart form { name, text, image? } creates a post
//                       (team only; name must be one of TEAM in lib/team.js)
//   DELETE /api/posts?id=123 -> deletes a post and its photo (team only)
// Team only = header `x-team-password` must match TEAM_PASSWORD.
// Posts and photos live in a D1 database bound as `DB`; photos are served
// by functions/api/images/[id].js.
import { json, setup, isTeam, wrongPassword } from "../../lib/api.js";
import { TEAM, isTeamMember } from "../../lib/team.js";

const MAX_TEXT = 280;
const FEED_LIMIT = 200;
// The page shrinks photos to a few hundred KB before upload; this is a safety cap
// that also stays well under D1's 2 MB per-value limit.
const MAX_IMAGE_BYTES = 1_500_000;
const MAX_IMAGE_SIDE = 4000;

export async function onRequestGet({ env }) {
  const notReady = await setup(env);
  if (notReady) return notReady;

  const { results } = await env.DB.prepare(
    `SELECT p.id, p.name, p.text, p.created_at, i.id AS image_id, i.width, i.height
       FROM posts p LEFT JOIN images i ON i.id = p.image_id
      ORDER BY p.created_at DESC, p.id DESC
      LIMIT ?`
  )
    .bind(FEED_LIMIT)
    .all();

  const posts = results.map((r) => ({
    id: r.id,
    name: r.name,
    text: r.text,
    created_at: r.created_at,
    image: r.image_id ? { url: `/api/images/${r.image_id}`, width: r.width, height: r.height } : null,
  }));
  return json({ posts, team: TEAM });
}

// Recognises JPEG, PNG and WebP by their first bytes, so a renamed file of
// another kind can't be stored as a "photo".
function sniffImageType(bytes) {
  const b = new Uint8Array(bytes.slice(0, 12));
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  const ascii = (from, to) => String.fromCharCode(...b.slice(from, to));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return null;
}

export async function onRequestPost({ request, env }) {
  const notReady = await setup(env);
  if (notReady) return notReady;
  if (!(await isTeam(request, env))) return wrongPassword();

  let form;
  try {
    form = await request.formData();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }

  const name = String(form.get("name") ?? "");
  const text = String(form.get("text") ?? "").trim();
  const file = form.get("image");
  const hasImage = file && typeof file === "object" && file.size > 0;

  if (!isTeamMember(name)) return json({ error: "Pick who you are from the list." }, 400);
  if (!text && !hasImage) return json({ error: "Write something or add a photo." }, 400);
  if ([...text].length > MAX_TEXT) return json({ error: `Post is too long (max ${MAX_TEXT}).` }, 400);

  const created_at = Date.now();
  let image = null;
  let meta;

  if (hasImage) {
    if (file.size > MAX_IMAGE_BYTES) return json({ error: "That photo is too big." }, 413);
    const bytes = await file.arrayBuffer();
    const mime = sniffImageType(bytes);
    if (!mime) return json({ error: "That file isn't a supported photo (JPG, PNG or WebP)." }, 415);
    const width = Math.round(Number(form.get("width")));
    const height = Math.round(Number(form.get("height")));
    const sizeOk = (n) => Number.isInteger(n) && n > 0 && n <= MAX_IMAGE_SIDE;
    if (!sizeOk(width) || !sizeOk(height)) return json({ error: "Invalid photo size." }, 400);

    // Both inserts run in one transaction; the post points at the new image row.
    const results = await env.DB.batch([
      env.DB.prepare("INSERT INTO images (mime, width, height, data) VALUES (?, ?, ?, ?)").bind(mime, width, height, bytes),
      env.DB.prepare("INSERT INTO posts (name, text, created_at, image_id) VALUES (?, ?, ?, last_insert_rowid())").bind(
        name,
        text,
        created_at
      ),
    ]);
    meta = results[1].meta;
    image = { url: `/api/images/${results[0].meta.last_row_id}`, width, height };
  } else {
    ({ meta } = await env.DB.prepare("INSERT INTO posts (name, text, created_at) VALUES (?, ?, ?)")
      .bind(name, text, created_at)
      .run());
  }

  return json({ post: { id: meta.last_row_id, name, text, created_at, image } }, 201);
}

export async function onRequestDelete({ request, env }) {
  const notReady = await setup(env);
  if (notReady) return notReady;
  if (!(await isTeam(request, env))) return wrongPassword();

  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) return json({ error: "Invalid post id." }, 400);

  const [, deletedPost] = await env.DB.batch([
    env.DB.prepare("DELETE FROM images WHERE id = (SELECT image_id FROM posts WHERE id = ?)").bind(id),
    env.DB.prepare("DELETE FROM posts WHERE id = ?").bind(id),
  ]);
  if (!deletedPost.meta.changes) return json({ error: "That post was already deleted." }, 404);
  return json({ ok: true });
}

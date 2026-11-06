// MJNM UPDATES API — runs on Cloudflare Pages Functions.
//   GET  /api/posts  -> { posts, team }: latest posts, newest first, plus the
//                       list of names and colors (public)
//   POST /api/posts  -> { name, text } creates a post (team only; name must be
//                       one of TEAM in lib/team.js)
//   DELETE /api/posts?id=123 -> deletes a post (team only)
// Team only = header `x-team-password` must match TEAM_PASSWORD.
// Posts live in a D1 database bound as `DB`.
import { json, setup, isTeam, wrongPassword } from "../../lib/api.js";
import { TEAM, isTeamMember } from "../../lib/team.js";

const MAX_TEXT = 280;
const FEED_LIMIT = 200;

export async function onRequestGet({ env }) {
  const notReady = await setup(env);
  if (notReady) return notReady;

  const { results } = await env.DB.prepare(
    "SELECT id, name, text, created_at FROM posts ORDER BY created_at DESC, id DESC LIMIT ?"
  )
    .bind(FEED_LIMIT)
    .all();
  return json({ posts: results, team: TEAM });
}

export async function onRequestPost({ request, env }) {
  const notReady = await setup(env);
  if (notReady) return notReady;
  if (!(await isTeam(request, env))) return wrongPassword();

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }

  const name = String(body?.name ?? "");
  const text = String(body?.text ?? "").trim();

  if (!isTeamMember(name)) return json({ error: "Pick who you are from the list." }, 400);
  if (!text) return json({ error: "Write something first." }, 400);
  if (text.length > MAX_TEXT) return json({ error: `Post is too long (max ${MAX_TEXT}).` }, 400);

  const created_at = Date.now();
  const { meta } = await env.DB.prepare("INSERT INTO posts (name, text, created_at) VALUES (?, ?, ?)")
    .bind(name, text, created_at)
    .run();

  return json({ post: { id: meta.last_row_id, name, text, created_at } }, 201);
}

export async function onRequestDelete({ request, env }) {
  const notReady = await setup(env);
  if (notReady) return notReady;
  if (!(await isTeam(request, env))) return wrongPassword();

  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) return json({ error: "Invalid post id." }, 400);

  const { meta } = await env.DB.prepare("DELETE FROM posts WHERE id = ?").bind(id).run();
  if (!meta.changes) return json({ error: "That post was already deleted." }, 404);
  return json({ ok: true });
}

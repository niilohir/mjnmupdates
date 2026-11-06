// MJNM UPDATES API — runs on Cloudflare Pages Functions.
//   GET  /api/posts  -> latest posts (newest first)
//   POST /api/posts  -> { name, text } creates a post
// Both require header `x-team-password` matching the TEAM_PASSWORD secret.
// Posts live in a D1 database bound as `DB`.

const MAX_NAME = 30;
const MAX_TEXT = 280;
const FEED_LIMIT = 200;

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

async function checkSetup(env) {
  if (!env.TEAM_PASSWORD) return json({ error: "Server not set up: TEAM_PASSWORD is missing." }, 500);
  if (!env.DB) return json({ error: "Server not set up: D1 database is not bound as DB." }, 500);
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS posts (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       name TEXT NOT NULL,
       text TEXT NOT NULL,
       created_at INTEGER NOT NULL
     )`
  ).run();
  return null;
}

async function authorized(request, env) {
  const given = request.headers.get("x-team-password") || "";
  const enc = new TextEncoder();
  const [a, b] = await Promise.all(
    [given, env.TEAM_PASSWORD].map((s) => crypto.subtle.digest("SHA-256", enc.encode(s)))
  );
  return crypto.subtle.timingSafeEqual(a, b);
}

async function guard(request, env) {
  const setupError = await checkSetup(env);
  if (setupError) return setupError;
  if (!(await authorized(request, env))) {
    // Small delay makes password guessing slower.
    await new Promise((r) => setTimeout(r, 400));
    return json({ error: "Wrong password." }, 401);
  }
  return null;
}

export async function onRequestGet({ request, env }) {
  const denied = await guard(request, env);
  if (denied) return denied;

  const { results } = await env.DB.prepare(
    "SELECT id, name, text, created_at FROM posts ORDER BY created_at DESC, id DESC LIMIT ?"
  )
    .bind(FEED_LIMIT)
    .all();
  return json({ posts: results });
}

export async function onRequestPost({ request, env }) {
  const denied = await guard(request, env);
  if (denied) return denied;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }

  const name = String(body?.name ?? "").trim().replace(/\s+/g, " ");
  const text = String(body?.text ?? "").trim();

  if (!name) return json({ error: "Pick a name first." }, 400);
  if (name.length > MAX_NAME) return json({ error: `Name is too long (max ${MAX_NAME}).` }, 400);
  if (!text) return json({ error: "Write something first." }, 400);
  if (text.length > MAX_TEXT) return json({ error: `Post is too long (max ${MAX_TEXT}).` }, 400);

  const created_at = Date.now();
  const { meta } = await env.DB.prepare("INSERT INTO posts (name, text, created_at) VALUES (?, ?, ?)")
    .bind(name, text, created_at)
    .run();

  return json({ post: { id: meta.last_row_id, name, text, created_at } }, 201);
}

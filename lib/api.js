// Shared helpers for the Pages Functions in functions/api/.

export const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

let schemaReady = false;

// Checks the server is configured and makes sure the tables exist.
// Returns an error Response, or null when everything is ready.
export async function setup(env) {
  if (!env.TEAM_PASSWORD) return json({ error: "Server not set up: TEAM_PASSWORD is missing." }, 500);
  if (!env.DB) return json({ error: "Server not set up: D1 database is not bound as DB." }, 500);
  if (schemaReady) return null;

  await env.DB.batch([
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS posts (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         name TEXT NOT NULL,
         text TEXT NOT NULL,
         created_at INTEGER NOT NULL
       )`
    ),
    // Photos live in their own table so loading the feed never reads image data.
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS images (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         mime TEXT NOT NULL,
         width INTEGER NOT NULL,
         height INTEGER NOT NULL,
         data BLOB NOT NULL
       )`
    ),
    // One row per person per emoji per post.
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS reactions (
         post_id INTEGER NOT NULL,
         name TEXT NOT NULL,
         emoji TEXT NOT NULL,
         created_at INTEGER NOT NULL,
         PRIMARY KEY (post_id, name, emoji)
       )`
    ),
  ]);
  // Databases created before photos existed need the image_id column added.
  const { results: cols } = await env.DB.prepare("PRAGMA table_info(posts)").all();
  if (!cols.some((c) => c.name === "image_id")) {
    await env.DB.prepare("ALTER TABLE posts ADD COLUMN image_id INTEGER").run();
  }
  schemaReady = true;
  return null;
}

// True when the `x-team-password` header matches TEAM_PASSWORD.
export async function isTeam(request, env) {
  const given = request.headers.get("x-team-password") || "";
  const enc = new TextEncoder();
  const [a, b] = await Promise.all(
    [given, env.TEAM_PASSWORD].map((s) => crypto.subtle.digest("SHA-256", enc.encode(s)))
  );
  return crypto.subtle.timingSafeEqual(a, b);
}

export async function wrongPassword() {
  // Small delay makes password guessing slower.
  await new Promise((r) => setTimeout(r, 400));
  return json({ error: "Wrong password." }, 401);
}

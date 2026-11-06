// Shared helpers for the Pages Functions in functions/api/.

export const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

// Checks the server is configured and makes sure the posts table exists.
// Returns an error Response, or null when everything is ready.
export async function setup(env) {
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

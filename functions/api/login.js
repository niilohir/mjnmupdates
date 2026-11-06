// POST /api/login — checks the team password (header `x-team-password`).
import { json, setup, isTeam, wrongPassword } from "../../lib/api.js";

export async function onRequestPost({ request, env }) {
  const notReady = await setup(env);
  if (notReady) return notReady;
  if (!(await isTeam(request, env))) return wrongPassword();
  return json({ ok: true });
}

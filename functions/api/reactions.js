// POST /api/reactions — { post_id, name, emoji, on } adds (on: true) or removes
// (on: false) one person's reaction on a post. Team only, like posting.
// Sending the wanted state (rather than "toggle") means a double click or a
// retried request can't flip it the wrong way.
import { json, setup, isTeam, wrongPassword } from "../../lib/api.js";
import { isTeamMember } from "../../lib/team.js";
import { isReaction } from "../../lib/reactions.js";

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

  const postId = Number(body?.post_id);
  const name = String(body?.name ?? "");
  const emoji = String(body?.emoji ?? "");
  const on = body?.on === true;

  if (!Number.isInteger(postId) || postId <= 0) return json({ error: "Invalid post id." }, 400);
  if (!isTeamMember(name)) return json({ error: "Pick who you are from the list." }, 400);
  if (!isReaction(emoji)) return json({ error: "That reaction isn't available." }, 400);

  if (!on) {
    await env.DB.prepare("DELETE FROM reactions WHERE post_id = ? AND name = ? AND emoji = ?")
      .bind(postId, name, emoji)
      .run();
    return json({ ok: true });
  }

  // Only adds the reaction if the post still exists.
  const { meta } = await env.DB.prepare(
    `INSERT OR IGNORE INTO reactions (post_id, name, emoji, created_at)
     SELECT ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM posts WHERE id = ?)`
  )
    .bind(postId, name, emoji, Date.now(), postId)
    .run();
  if (!meta.changes) {
    const post = await env.DB.prepare("SELECT 1 FROM posts WHERE id = ?").bind(postId).first();
    if (!post) return json({ error: "That post was deleted." }, 404);
  }
  return json({ ok: true });
}

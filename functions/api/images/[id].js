// GET /api/images/123 — serves a post's photo (public, like the feed).
import { setup } from "../../../lib/api.js";

export async function onRequestGet({ params, env }) {
  const notReady = await setup(env);
  if (notReady) return notReady;

  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return new Response("Not found", { status: 404 });

  const row = await env.DB.prepare("SELECT mime, data FROM images WHERE id = ?").bind(id).first();
  if (!row) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(row.data), {
    headers: {
      "content-type": row.mime,
      // Image ids are never reused, so browsers can keep their copy. "private"
      // stops shared caches from holding on to photos after a post is deleted.
      "cache-control": "private, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
    },
  });
}

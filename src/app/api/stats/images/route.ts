// POST /api/stats/images : adresses des pochettes et photos connues pour les entrées affichées
// (tops, mosaïque). Réservé aux comptes connectés : les images sont en cache dans la base.
import { z } from "zod";
import { getDb } from "@/lib/db";
import { findImages } from "@/lib/db/images";
import { httpStatusFor, toUserError } from "@/lib/user-error";
import { requireUserId } from "@/providers/spotify/session";

/** Ce que la page affiche au plus d'un coup (tops de 100, mosaïque). */
const MAX = 300;
const text = z.string().max(500);

const BodySchema = z.object({
  tracks: z.array(z.object({ key: text, artist: text, title: text })).max(MAX),
  artists: z.array(text).max(MAX),
  albums: z.array(z.object({ key: text, artist: text, album: text })).max(MAX),
});

export async function POST(request: Request): Promise<Response> {
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return Response.json({ error: "Content-Type application/json attendu" }, { status: 415 });
  }
  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json({ error: "Corps attendu : { tracks, artists, albums }" }, { status: 400 });
  try {
    await requireUserId();
    return Response.json(await findImages(getDb(), parsed.data));
  } catch (e) {
    const error = toUserError(e);
    return Response.json({ error }, { status: httpStatusFor(error.kind) });
  }
}

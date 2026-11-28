// POST /api/convert : lit la playlist source puis cherche chaque titre sur la
// destination, en renvoyant la progression en flux NDJSON (voir lib/conversion-stream).
import { z } from "zod";
import { matchPlaylist, resolveSource } from "@/core/convert";
import { ProviderError } from "@/core/errors";
import { type ConversionEvent, encodeEvent, NDJSON_CONTENT_TYPE } from "@/lib/conversion-stream";
import { httpStatusFor, toUserError } from "@/lib/user-error";
import { createConversionProviders } from "@/providers/registry";
import { getSpotifyAccessToken } from "@/providers/spotify/session";

const BodySchema = z.object({ url: z.string().trim().min(1).max(2_000) });

/**
 * Durée maximale de la requête sur Vercel (en secondes) : une grosse playlist peut prendre
 * plusieurs minutes (recherche titre par titre). 300 s est le maximum de l'offre gratuite.
 */
export const maxDuration = 300;

/**
 * Le token Spotify est obtenu une fois avant le flux et réutilisé pour toute la conversion :
 * on demande une marge de 30 min pour qu'il n'expire pas en cours de route.
 */
const TOKEN_MIN_VALIDITY_MS = 30 * 60_000;

function jsonError(e: unknown): Response {
  const error = toUserError(e);
  return Response.json({ error }, { status: httpStatusFor(error.kind) });
}

export async function POST(request: Request): Promise<Response> {
  // Exiger du JSON oblige un navigateur tiers à faire une requête préalable (CORS),
  // qui sera refusée : protège contre les soumissions venant d'autres sites.
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return Response.json({ error: "Content-Type application/json attendu" }, { status: 415 });
  }
  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Corps attendu : { url: string }" }, { status: 400 });
  }

  // Avant le flux : token valide au moins 30 min (rafraîchi en base si besoin).
  let token: string;
  try {
    token = await getSpotifyAccessToken(TOKEN_MIN_VALIDITY_MS);
  } catch (e) {
    return jsonError(e);
  }
  const { sources, destination } = createConversionProviders(async () => token);
  const signal = request.signal;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: ConversionEvent) =>
        controller.enqueue(encoder.encode(encodeEvent(event)));
      try {
        const { provider, ref } = await resolveSource(parsed.data.url, sources);
        if (provider.id === destination.id) {
          throw new ProviderError({
            kind: "unsupported",
            provider: provider.id,
            message: "La playlist est déjà sur la plateforme de destination.",
          });
        }
        const playlist = await provider.getPlaylist(ref);
        send({
          type: "playlist",
          name: playlist.name,
          source: provider.id,
          total: playlist.tracks.length,
          tracks: playlist.tracks.map((t) => ({
            title: t.title,
            artist: t.artists[0] ?? "",
            artworkUrl: t.artworkUrl,
          })),
        });
        const report = await matchPlaylist({
          playlist,
          destination,
          signal,
          onProgress: (done, total, last) =>
            send({
              type: "progress",
              done,
              total,
              item: last && {
                status: last.status,
                artworkUrl: (last.selected ?? last.best?.track)?.artworkUrl,
              },
            }),
        });
        send({ type: "done", report });
      } catch (e) {
        // Client parti : personne pour lire l'erreur.
        if (signal.aborted) return;
        send({ type: "error", error: toUserError(e) });
      } finally {
        if (!signal.aborted) controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": NDJSON_CONTENT_TYPE,
      "cache-control": "no-store",
      // Évite qu'un proxy (nginx…) garde les lignes en mémoire au lieu de les transmettre.
      "x-accel-buffering": "no",
    },
  });
}

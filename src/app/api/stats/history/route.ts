// GET /api/stats/history : historique enregistré de l'utilisateur connecté, en flux NDJSON
// (dictionnaire des morceaux, puis écoutes par pages). Les stats sont calculées dans le navigateur.
// DELETE /api/stats/history : supprime tout cet historique.
import { getDb } from "@/lib/db";
import {
  cursorAfter,
  deleteHistory,
  historySummary,
  playsPage,
  userTracks,
} from "@/lib/db/history";
import { NDJSON_CONTENT_TYPE, ndjsonLine } from "@/lib/ndjson";
import type { HistoryEvent } from "@/lib/stats-sync";
import { httpStatusFor, toUserError } from "@/lib/user-error";
import { requireUserId } from "@/providers/spotify/session";

/** Écoutes par page lue en base (~1 Mo de réponse Neon). */
const PAGE = 20_000;

/** Un gros historique (~300 000 écoutes) se lit en une quinzaine de pages. */
export const maxDuration = 60;

function jsonError(e: unknown): Response {
  const error = toUserError(e);
  return Response.json({ error }, { status: httpStatusFor(error.kind) });
}

export async function GET(request: Request): Promise<Response> {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch (e) {
    return jsonError(e);
  }
  const db = getDb();
  const signal = request.signal;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: HistoryEvent) => controller.enqueue(encoder.encode(ndjsonLine(event)));
      try {
        const summary = await historySummary(db, userId);
        send({ type: "summary", plays: summary.plays });
        if (summary.plays > 0) {
          send({ type: "tracks", tracks: await userTracks(db, userId) });
          let after = null;
          while (!signal.aborted) {
            const rows = await playsPage(db, userId, after, PAGE);
            if (rows.length === 0) break;
            send({ type: "plays", rows });
            after = cursorAfter(rows.at(-1)!);
          }
        }
        send({ type: "end" });
      } catch (e) {
        if (!signal.aborted) send({ type: "error", error: toUserError(e) });
      } finally {
        if (!signal.aborted) controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": NDJSON_CONTENT_TYPE,
      "cache-control": "no-store",
      "x-accel-buffering": "no",
    },
  });
}

export async function DELETE(): Promise<Response> {
  // DELETE n'est pas une méthode « simple » : un autre site doit passer par une requête
  // préalable (CORS), refusée. Pas besoin de vérifier le Content-Type ici.
  try {
    const userId = await requireUserId();
    return Response.json({ deleted: await deleteHistory(getDb(), userId) });
  } catch (e) {
    return jsonError(e);
  }
}

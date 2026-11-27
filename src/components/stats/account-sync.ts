// Côté navigateur (Web Worker) : téléchargement de l'historique enregistré et envoi d'un
// export par lots. `fetch` envoie le cookie de session (même origine).
import type { Play } from "@/core/stats";
import type { TrackRow } from "@/lib/db/history";
import { readNdjson } from "@/lib/ndjson";
import {
  encodePlay,
  IMPORT_BATCH,
  type ImportResponse,
  parseHistoryEvent,
  rowsToPlays,
} from "@/lib/stats-sync";

/** Erreur à montrer telle quelle (message en français, éventuellement « non connecté »). */
export class SyncError extends Error {
  constructor(
    message: string,
    readonly unauthorized = false,
  ) {
    super(message);
  }
}

async function errorFrom(res: Response): Promise<SyncError> {
  const body: unknown = await res.json().catch(() => null);
  const error = (body as { error?: unknown } | null)?.error;
  const message =
    typeof error === "string"
      ? error
      : error &&
          typeof error === "object" &&
          "message" in error &&
          typeof error.message === "string"
        ? error.message
        : `Erreur du serveur (HTTP ${res.status})`;
  return new SyncError(message, res.status === 401);
}

/** Télécharge tout l'historique enregistré. `onProgress(reçues, total)` après chaque page. */
export async function downloadHistory(
  onProgress: (done: number, total: number) => void,
  fetchImpl: typeof fetch = fetch,
): Promise<Play[]> {
  const res = await fetchImpl("/api/stats/history", { cache: "no-store" });
  if (!res.ok || !res.body) throw await errorFrom(res);

  const tracks = new Map<number, TrackRow>();
  const plays: Play[] = [];
  let total = 0;
  let ended = false;
  for await (const event of readNdjson(res.body, parseHistoryEvent)) {
    if (event.type === "summary") total = event.plays;
    else if (event.type === "tracks") for (const t of event.tracks) tracks.set(t[0], t);
    else if (event.type === "plays") {
      rowsToPlays(tracks, event.rows, plays);
      onProgress(plays.length, total);
    } else if (event.type === "end") ended = true;
    else throw new SyncError(event.error.message, event.error.kind === "unauthorized");
  }
  // Flux coupé avant la fin : des stats partielles seraient fausses.
  if (!ended) throw new SyncError("Téléchargement de l'historique interrompu. Réessaie.");
  return plays;
}

export interface UploadResult {
  received: number;
  inserted: number;
}

/**
 * Envoie les écoutes par lots de IMPORT_BATCH. `onProgress(envoyées, total, ajoutées)`
 * après chaque lot. Réimporter le même export n'ajoute rien (doublons ignorés en base).
 */
export async function uploadPlays(
  plays: readonly Play[],
  onProgress: (sent: number, total: number, inserted: number) => void,
  fetchImpl: typeof fetch = fetch,
): Promise<UploadResult> {
  let inserted = 0;
  for (let i = 0; i < plays.length; i += IMPORT_BATCH) {
    const batch = plays.slice(i, i + IMPORT_BATCH).map(encodePlay);
    const res = await fetchImpl("/api/stats/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ plays: batch }),
    });
    if (!res.ok) throw await errorFrom(res);
    inserted += ((await res.json()) as ImportResponse).inserted;
    onProgress(Math.min(i + IMPORT_BATCH, plays.length), plays.length, inserted);
  }
  return { received: plays.length, inserted };
}

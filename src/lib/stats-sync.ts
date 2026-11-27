// Échanges navigateur ↔ serveur pour l'historique d'écoute : envoi par lots (import) et
// téléchargement de l'historique enregistré (flux NDJSON). Partagé par les routes et le worker.
import { z } from "zod";
import type { Play } from "@/core/stats";
import type { PlayRow, TrackRow } from "@/lib/db/history";
import type { UserError } from "./user-error";

/** Écoutes par requête d'import : ~1 Mo de JSON, loin de la limite de ~4,5 Mo de Vercel. */
export const IMPORT_BATCH = 5_000;

/** Écoute compacte (tableau plutôt qu'objet : environ deux fois moins de données). */
export type WirePlay = [
  number,
  number,
  "music" | "podcast",
  string,
  string,
  string | null,
  string | null,
  boolean | null,
  number,
];

export function encodePlay(p: Play): WirePlay {
  return [p.endedAt, p.msPlayed, p.kind, p.title, p.artist, p.album, p.uri, p.skipped, p.offlineTs];
}

export function decodePlay(w: WirePlay): Play {
  return {
    endedAt: w[0],
    msPlayed: w[1],
    kind: w[2],
    title: w[3],
    artist: w[4],
    album: w[5],
    uri: w[6],
    skipped: w[7],
    offlineTs: w[8],
  };
}

const text = z.string().min(1).max(500);
const WirePlaySchema = z.tuple([
  z.number().int().min(Date.parse("2006-01-01")).max(Date.parse("2100-01-01")),
  z
    .number()
    .int()
    .nonnegative()
    .max(24 * 3_600_000),
  z.enum(["music", "podcast"]),
  text,
  text,
  z.string().max(500).nullable(),
  // « spotify:track:… », mais aussi « spotify:local:… » pour les fichiers locaux.
  z.string().startsWith("spotify:").max(500).nullable(),
  z.boolean().nullable(),
  z.number().int().nonnegative(),
]);

export const ImportRequestSchema = z.object({
  plays: z.array(WirePlaySchema).min(1).max(IMPORT_BATCH),
});
export type ImportRequest = z.infer<typeof ImportRequestSchema>;

export interface ImportResponse {
  received: number;
  inserted: number;
}

/** Événements du téléchargement de l'historique (GET /api/stats/history). */
export type HistoryEvent =
  | { type: "summary"; plays: number }
  | { type: "tracks"; tracks: TrackRow[] }
  | { type: "plays"; rows: PlayRow[] }
  | { type: "end" }
  | { type: "error"; error: UserError };

// Flux de notre propre serveur : on vérifie l'enveloppe, et le contenu juste assez pour
// qu'une réponse inattendue échoue proprement au lieu de produire des stats fausses.
const HistoryEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("summary"), plays: z.number() }),
  z.object({
    type: z.literal("tracks"),
    tracks: z.array(
      z.tuple([
        z.number(),
        z.string(),
        z.string(),
        z.string().nullable(),
        z.string().nullable(),
        z.enum(["music", "podcast"]),
      ]),
    ),
  }),
  z.object({
    type: z.literal("plays"),
    rows: z.array(
      z.tuple([z.number(), z.number(), z.number(), z.boolean().nullable(), z.number()]),
    ),
  }),
  z.object({ type: z.literal("end") }),
  z.object({
    type: z.literal("error"),
    error: z.object({
      kind: z.string(),
      provider: z.string().nullable(),
      message: z.string(),
      retryAfterSeconds: z.number().nullable(),
    }),
  }),
]);

export function parseHistoryEvent(value: unknown): HistoryEvent {
  return HistoryEventSchema.parse(value) as HistoryEvent;
}

/** Reconstruit les écoutes à partir du dictionnaire de morceaux et des lignes compactes. */
export function rowsToPlays(
  tracks: ReadonlyMap<number, TrackRow>,
  rows: readonly PlayRow[],
  out: Play[],
): void {
  for (const [trackId, endedAt, msPlayed, skipped, offlineTs] of rows) {
    const t = tracks.get(trackId);
    if (!t) continue; // morceau supprimé entre deux pages : écoute ignorée
    out.push({
      endedAt,
      msPlayed,
      kind: t[5],
      title: t[1],
      artist: t[2],
      album: t[3],
      uri: t[4],
      skipped,
      offlineTs,
    });
  }
}

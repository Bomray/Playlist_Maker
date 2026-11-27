// Historique d'écoute en base : import par lots, lecture paginée, suppression.
import { z } from "zod";
import type { Play } from "@/core/stats";
import type { Db } from "./types";

export type PlaySource = "import" | "api";

/**
 * Identifiant stable d'un morceau : son URI, ou type + artiste + titre sans URI.
 * Séparateur « \u001f » (séparateur d'unité) : PostgreSQL refuse le caractère nul dans un texte.
 */
export function trackKey(p: Pick<Play, "uri" | "kind" | "artist" | "title">): string {
  return p.uri ?? `${p.kind}:${p.artist}\u001f${p.title}`;
}

/**
 * Enregistre un lot d'écoutes en une seule requête : morceaux créés au besoin (une fois
 * chacun), écoutes déjà présentes ignorées. Renvoie le nombre d'écoutes réellement ajoutées.
 * `unnest` transforme les tableaux en lignes : une requête par lot au lieu d'une par écoute.
 */
export async function importPlays(
  db: Db,
  userId: string,
  plays: readonly Play[],
  source: PlaySource,
): Promise<number> {
  if (plays.length === 0) return 0;
  const rows = await db.query(
    `WITH input AS (
       SELECT * FROM unnest($2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::text[],
                            $8::timestamptz[], $9::int[], $10::bool[], $12::bigint[])
         AS t(track_key, uri, title, artist, album, kind, ended_at, ms_played, skipped, offline_ts)
     ),
     upserted AS (
       INSERT INTO tracks (track_key, uri, title, artist, album, kind)
       SELECT DISTINCT ON (track_key) track_key, uri, title, artist, album, kind FROM input
       -- DO UPDATE (sans rien changer d'utile) pour que RETURNING donne aussi les morceaux existants.
       ON CONFLICT (track_key) DO UPDATE SET album = COALESCE(tracks.album, EXCLUDED.album)
       RETURNING id, track_key
     ),
     inserted AS (
       INSERT INTO plays (user_id, track_id, ended_at, ms_played, source, skipped, offline_ts)
       SELECT $1, u.id, i.ended_at, i.ms_played, $11, i.skipped, i.offline_ts
       FROM input i JOIN upserted u USING (track_key)
       ON CONFLICT DO NOTHING
       RETURNING 1
     )
     SELECT count(*)::int AS inserted FROM inserted`,
    [
      userId,
      plays.map(trackKey),
      plays.map((p) => p.uri),
      plays.map((p) => p.title),
      plays.map((p) => p.artist),
      plays.map((p) => p.album),
      plays.map((p) => p.kind),
      plays.map((p) => new Date(p.endedAt).toISOString()),
      plays.map((p) => p.msPlayed),
      plays.map((p) => p.skipped),
      source,
      plays.map((p) => p.offlineTs),
    ],
  );
  return z.object({ inserted: z.number() }).parse(rows[0]).inserted;
}

/**
 * Règle « l'export fait foi » (décision 0002) : sur la période couverte par l'export importé,
 * les écoutes enregistrées automatiquement (`api`, durée estimée) sont ignorées à la lecture,
 * sans être supprimées. `coverage` = première et dernière écoute importée de l'utilisateur.
 */
const COVERAGE = `coverage AS (
  SELECT min(ended_at) AS from_ts, max(ended_at) AS to_ts FROM plays WHERE user_id = $1 AND source = 'import'
)`;
const VISIBLE = `NOT (source = 'api' AND coverage.from_ts IS NOT NULL
  AND ended_at BETWEEN coverage.from_ts AND coverage.to_ts)`;

export interface HistorySummary {
  plays: number;
  first: number | null;
  last: number | null;
}

const toMs = (v: unknown) => (v === null ? null : new Date(v as string | Date).getTime());

export async function historySummary(db: Db, userId: string): Promise<HistorySummary> {
  const rows = await db.query(
    `WITH ${COVERAGE} SELECT count(*)::int AS plays, min(ended_at) AS first, max(ended_at) AS last
     FROM plays, coverage WHERE user_id = $1 AND ${VISIBLE}`,
    [userId],
  );
  const row = z.object({ plays: z.number(), first: z.unknown(), last: z.unknown() }).parse(rows[0]);
  return { plays: row.plays, first: toMs(row.first), last: toMs(row.last) };
}

/** Morceau écouté par l'utilisateur : [id, titre, artiste, album, uri, type]. */
export type TrackRow = [number, string, string, string | null, string | null, "music" | "podcast"];
/** Écoute compacte : [id du morceau, fin (ms UTC), durée écoutée (ms), passée, horodatage hors ligne]. */
export type PlayRow = [number, number, number, boolean | null, number];

const TrackDbRow = z.object({
  id: z.union([z.number(), z.string()]).transform(Number),
  title: z.string(),
  artist: z.string(),
  album: z.string().nullable(),
  uri: z.string().nullable(),
  kind: z.enum(["music", "podcast"]),
});

export async function userTracks(db: Db, userId: string): Promise<TrackRow[]> {
  const rows = await db.query(
    `SELECT t.id, t.title, t.artist, t.album, t.uri, t.kind FROM tracks t
     WHERE EXISTS (SELECT 1 FROM plays p WHERE p.user_id = $1 AND p.track_id = t.id)`,
    [userId],
  );
  return rows.map((r) => {
    const t = TrackDbRow.parse(r);
    return [t.id, t.title, t.artist, t.album, t.uri, t.kind];
  });
}

const PlayDbRow = z.object({
  track_id: z.union([z.number(), z.string()]).transform(Number),
  ended_ms: z.union([z.number(), z.string()]).transform(Number),
  ms_played: z.number(),
  skipped: z.boolean().nullable(),
  offline_ts: z.union([z.number(), z.string()]).transform(Number),
});

/** Curseur de pagination : clé complète de la dernière écoute de la page précédente. */
export interface PlaysCursor {
  endedMs: number;
  trackId: number;
  msPlayed: number;
  offlineTs: number;
}

export function cursorAfter(row: PlayRow): PlaysCursor {
  return { trackId: row[0], endedMs: row[1], msPlayed: row[2], offlineTs: row[4] };
}

/**
 * Une page d'écoutes triées par date, après `after` (exclu). Pagination par curseur sur la
 * clé complète : plusieurs écoutes peuvent avoir la même date. L'historique complet
 * (~300 000 lignes) ne tient pas dans une seule réponse HTTP de Neon.
 */
export async function playsPage(
  db: Db,
  userId: string,
  after: PlaysCursor | null,
  limit: number,
): Promise<PlayRow[]> {
  const rows = await db.query(
    `WITH ${COVERAGE}
     SELECT track_id, (extract(epoch FROM ended_at) * 1000)::bigint AS ended_ms, ms_played, skipped, offline_ts
     FROM plays, coverage
     WHERE user_id = $1 AND ${VISIBLE} AND ($2::timestamptz IS NULL OR (ended_at, track_id, ms_played, offline_ts) > ($2::timestamptz, $3::bigint, $5::int, $6::bigint))
     ORDER BY ended_at, track_id, ms_played, offline_ts
     LIMIT $4`,
    [
      userId,
      after ? new Date(after.endedMs).toISOString() : null,
      after?.trackId ?? 0,
      limit,
      after?.msPlayed ?? 0,
      after?.offlineTs ?? 0,
    ],
  );
  return rows.map((r) => {
    const p = PlayDbRow.parse(r);
    return [p.track_id, p.ended_ms, p.ms_played, p.skipped, p.offline_ts];
  });
}

/** Supprime tout l'historique de l'utilisateur ; renvoie le nombre d'écoutes effacées. */
export async function deleteHistory(db: Db, userId: string): Promise<number> {
  const rows = await db.query(
    "WITH d AS (DELETE FROM plays WHERE user_id = $1 RETURNING 1) SELECT count(*)::int AS deleted FROM d",
    [userId],
  );
  return z.object({ deleted: z.number() }).parse(rows[0]).deleted;
}

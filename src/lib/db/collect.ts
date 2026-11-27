// Enregistrement continu des écoutes : accord de l'utilisateur, curseur et dernier résultat.
import { z } from "zod";
import type { Db } from "./types";

export interface CollectStatus {
  collecting: boolean;
  lastCollectedAt: number | null;
  lastError: string | null;
  /** Écoutes enregistrées automatiquement (origine `api`). */
  apiPlays: number;
}

const toMs = (v: unknown) =>
  v === null || v === undefined ? null : new Date(v as string | Date).getTime();

export async function collectStatus(db: Db, userId: string): Promise<CollectStatus> {
  const rows = await db.query(
    `SELECT u.collecting, u.last_collected_at, u.last_collect_error,
            (SELECT count(*)::int FROM plays p WHERE p.user_id = u.id AND p.source = 'api') AS api_plays
     FROM users u WHERE u.id = $1`,
    [userId],
  );
  const r = z
    .object({
      collecting: z.boolean(),
      last_collected_at: z.unknown(),
      last_collect_error: z.string().nullable(),
      api_plays: z.number(),
    })
    .parse(rows[0]);
  return {
    collecting: r.collecting,
    lastCollectedAt: toMs(r.last_collected_at),
    lastError: r.last_collect_error,
    apiPlays: r.api_plays,
  };
}

export async function setCollecting(db: Db, userId: string, enabled: boolean): Promise<void> {
  // Réactivation : on efface l'ancienne erreur, elle ne concerne plus la nouvelle tentative.
  await db.query(
    "UPDATE users SET collecting = $2, last_collect_error = CASE WHEN $2 THEN NULL ELSE last_collect_error END, updated_at = now() WHERE id = $1",
    [userId, enabled],
  );
}

export interface CollectTarget {
  id: string;
  /** Date (ms UTC) de la dernière écoute déjà enregistrée par la collecte, ou `null`. */
  cursor: number | null;
}

/** Utilisateurs qui ont donné leur accord. */
export async function collectTargets(db: Db): Promise<CollectTarget[]> {
  const rows = await db.query("SELECT id, collect_cursor FROM users WHERE collecting ORDER BY id");
  return rows.map((r) => {
    const t = z
      .object({ id: z.string(), collect_cursor: z.union([z.number(), z.string()]).nullable() })
      .parse(r);
    return { id: t.id, cursor: t.collect_cursor === null ? null : Number(t.collect_cursor) };
  });
}

/** Résultat d'une collecte : nouveau curseur si elle a réussi, ou message d'erreur. */
export async function recordCollect(
  db: Db,
  userId: string,
  result: { cursor: number | null } | { error: string },
): Promise<void> {
  if ("error" in result) {
    await db.query(
      "UPDATE users SET last_collected_at = now(), last_collect_error = $2 WHERE id = $1",
      [userId, result.error],
    );
  } else {
    await db.query(
      "UPDATE users SET last_collected_at = now(), last_collect_error = NULL, collect_cursor = COALESCE($2, collect_cursor) WHERE id = $1",
      [userId, result.cursor],
    );
  }
}

/** Cible de collecte d'un utilisateur précis (pour la première collecte à l'activation). */
export async function collectTargetFor(db: Db, userId: string): Promise<CollectTarget> {
  const rows = await db.query("SELECT collect_cursor FROM users WHERE id = $1", [userId]);
  const raw = rows[0]?.collect_cursor;
  return { id: userId, cursor: raw === null || raw === undefined ? null : Number(raw) };
}

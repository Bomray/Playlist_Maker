// Enregistrement continu des écoutes (décision 0002) : lit `recently-played` (50 dernières
// écoutes au plus) pour chaque utilisateur qui l'a accepté, et enregistre les nouvelles.
import { z } from "zod";
import { ProviderError } from "@/core/errors";
import type { Play } from "@/core/stats";
import { type CollectTarget, collectTargets, recordCollect } from "@/lib/db/collect";
import { importPlays } from "@/lib/db/history";
import { fetchJson } from "@/lib/http";
import { type AccountDeps, getValidAccessToken } from "./account";

const RecentlyPlayedSchema = z.object({
  items: z.array(
    z.object({
      played_at: z.string(),
      track: z
        .object({
          uri: z.string(),
          name: z.string(),
          duration_ms: z.number(),
          type: z.string().optional(),
          artists: z.array(z.object({ name: z.string() })).optional(),
          album: z.object({ name: z.string() }).nullish(),
          show: z.object({ name: z.string() }).nullish(),
        })
        .nullable(),
    }),
  ),
});

/**
 * Écoutes récentes converties au format commun. Limite connue : Spotify ne donne pas la durée
 * réellement écoutée, seulement celle du morceau, utilisée comme estimation.
 */
export function toPlays(items: z.infer<typeof RecentlyPlayedSchema>["items"]): Play[] {
  const plays: Play[] = [];
  for (const { played_at, track } of items) {
    const endedAt = Date.parse(played_at);
    if (!track || Number.isNaN(endedAt)) continue;
    const podcast = track.type === "episode";
    plays.push({
      endedAt,
      msPlayed: track.duration_ms,
      kind: podcast ? "podcast" : "music",
      title: track.name,
      artist: (podcast ? track.show?.name : track.artists?.[0]?.name) ?? "Artiste inconnu",
      album: podcast ? null : (track.album?.name ?? null),
      uri: track.uri,
      skipped: null,
      offlineTs: 0,
    });
  }
  return plays;
}

export interface CollectResult {
  userId: string;
  fetched: number;
  inserted: number;
  error: string | null;
}

/** Collecte pour un utilisateur. Ne lève pas : l'erreur est enregistrée et renvoyée. */
export async function collectForUser(
  deps: AccountDeps,
  target: CollectTarget,
): Promise<CollectResult> {
  try {
    const token = await getValidAccessToken(deps, target.id);
    const params = new URLSearchParams({ limit: "50" });
    // `after` : seulement les écoutes postérieures à la dernière déjà enregistrée.
    if (target.cursor !== null) params.set("after", String(target.cursor));
    const res = await fetchJson(
      `https://api.spotify.com/v1/me/player/recently-played?${params}`,
      RecentlyPlayedSchema,
      {
        provider: "spotify",
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      },
    );
    const plays = toPlays(res.items);
    const inserted = await importPlays(deps.db, target.id, plays, "api");
    const newest = plays.reduce<number | null>(
      (max, p) => (max === null || p.endedAt > max ? p.endedAt : max),
      null,
    );
    await recordCollect(deps.db, target.id, { cursor: newest });
    return { userId: target.id, fetched: plays.length, inserted, error: null };
  } catch (e) {
    // Une erreur de programmation doit rester visible dans les journaux du serveur.
    if (!(e instanceof ProviderError)) console.error("Collecte : erreur inattendue", e);
    const error =
      e instanceof ProviderError
        ? e.kind === "unauthorized"
          ? "Accès Spotify expiré : reconnecte-toi pour reprendre l'enregistrement."
          : e.message
        : "Erreur inattendue pendant la collecte.";
    await recordCollect(deps.db, target.id, { error });
    return { userId: target.id, fetched: 0, inserted: 0, error };
  }
}

/** Collecte pour tous les utilisateurs qui ont donné leur accord, l'un après l'autre. */
export async function collectAll(deps: AccountDeps): Promise<CollectResult[]> {
  const results: CollectResult[] = [];
  for (const target of await collectTargets(deps.db))
    results.push(await collectForUser(deps, target));
  return results;
}

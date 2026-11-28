// Orchestration d'une conversion de playlist d'une plateforme vers une autre :
// 1. trouver le provider source à partir du lien (`resolveSource`) ;
// 2. chercher chaque titre sur la destination et le noter (`matchPlaylist`) ;
// 3. laisser l'utilisateur corriger (`selectCandidate`) ;
// 4. préparer la playlist à créer (`buildNewPlaylist`), créée ensuite par
//    `destination.createPlaylist(...)` après validation.
// Les providers sont injectés : ce module ne connaît que l'interface MusicProvider.
import type { MusicProvider } from "@/providers/types";
import { ProviderError, type ProviderErrorKind } from "./errors";
import { matchTrack, type TrackMatch } from "./matching";
import { scoreCandidate } from "./matching/score";
import type { NewPlaylist, Playlist, PlaylistRef, Track } from "./models";

export interface ConversionSummary {
  total: number;
  found: number;
  uncertain: number;
  notFound: number;
  manual: number;
  /** Titres qui seront réellement ajoutés à la playlist. */
  selected: number;
}

export interface ConversionReport {
  playlist: Playlist;
  destination: MusicProvider["id"];
  results: TrackMatch[];
  summary: ConversionSummary;
}

/**
 * Erreurs qui touchent toute la conversion : inutile de continuer titre par titre,
 * ils échoueraient tous de la même façon. On les remonte telles quelles à l'UI.
 */
const FATAL_KINDS: ReadonlySet<ProviderErrorKind> = new Set([
  "unauthorized",
  "forbidden",
  "quota",
  "rate_limited",
  "network",
  "unsupported",
]);

/** Trouve la plateforme qui reconnaît ce lien et en extrait la référence de playlist. */
export function findSourceProvider(
  url: string,
  providers: readonly MusicProvider[],
): { provider: MusicProvider; ref: PlaylistRef } {
  for (const provider of providers) {
    const ref = provider.parsePlaylistUrl(url.trim());
    if (ref) return { provider, ref };
  }
  throw new ProviderError({
    kind: "unsupported",
    provider: null,
    message: "Lien non reconnu : colle le lien d'une playlist Deezer, YouTube Music ou Spotify.",
    detail: url,
  });
}

/**
 * Comme `findSourceProvider`, mais développe d'abord un éventuel lien court
 * (ex. `link.deezer.com/s/…`) via `expandUrl`, ce qui demande un appel réseau.
 */
export async function resolveSource(
  url: string,
  providers: readonly MusicProvider[],
): Promise<{ provider: MusicProvider; ref: PlaylistRef }> {
  const direct = providers.some((p) => p.parsePlaylistUrl(url.trim()) !== null);
  if (!direct) {
    for (const provider of providers) {
      const expanded = await provider.expandUrl?.(url);
      if (expanded) return findSourceProvider(expanded, providers);
    }
  }
  return findSourceProvider(url, providers);
}

export function summarize(results: readonly TrackMatch[]): ConversionSummary {
  const summary: ConversionSummary = {
    total: results.length,
    found: 0,
    uncertain: 0,
    notFound: 0,
    manual: 0,
    selected: 0,
  };
  for (const r of results) {
    if (r.status === "found") summary.found++;
    else if (r.status === "uncertain") summary.uncertain++;
    else if (r.status === "not_found") summary.notFound++;
    else summary.manual++;
    if (r.selected) summary.selected++;
  }
  return summary;
}

export interface MatchPlaylistOptions {
  playlist: Playlist;
  destination: MusicProvider;
  /** Appelé après chaque titre traité (avec son résultat), pour afficher la progression. */
  onProgress?: (done: number, total: number, last?: TrackMatch) => void;
  /** Annulation (ex. l'utilisateur a quitté la page) : arrête avant le titre suivant. */
  signal?: AbortSignal;
}

/**
 * Cherche chaque titre de la playlist sur la destination, un par un.
 * Séquentiel volontairement : les providers ont déjà leur limiteur de débit, et un
 * ordre déterministe rend la progression et les tests plus simples.
 */
export async function matchPlaylist({
  playlist,
  destination,
  onProgress,
  signal,
}: MatchPlaylistOptions): Promise<ConversionReport> {
  const results: TrackMatch[] = [];
  const total = playlist.tracks.length;
  onProgress?.(0, total);

  for (const track of playlist.tracks) {
    // Lève l'erreur d'annulation (`signal.reason`) : inutile de consommer le quota.
    signal?.throwIfAborted();
    const match = await matchOne(track, destination);
    results.push(match);
    onProgress?.(results.length, total, match);
  }

  return { playlist, destination: destination.id, results, summary: summarize(results) };
}

async function matchOne(track: Track, destination: MusicProvider): Promise<TrackMatch> {
  try {
    return matchTrack(track, await destination.searchTrack(track));
  } catch (e) {
    if (!(e instanceof ProviderError) || FATAL_KINDS.has(e.kind)) throw e;
    // Erreur propre à ce titre (réponse inattendue, 404…) : on le marque introuvable
    // en gardant la raison, et on continue avec les suivants.
    return {
      source: track,
      status: "not_found",
      best: null,
      candidates: [],
      selected: null,
      error: { kind: e.kind, message: e.message },
    };
  }
}

/**
 * Correction manuelle : choisit `track` pour le titre n° `index` (un des candidats
 * ou un titre trouvé par une recherche à la main), ou le retire avec `null`.
 * Ne modifie pas le rapport reçu : en renvoie un nouveau.
 */
export function selectCandidate(
  report: ConversionReport,
  index: number,
  track: Track | null,
): ConversionReport {
  const current = report.results[index];
  if (!current) throw new RangeError(`Aucun titre à l'index ${index}`);
  if (track && track.provider !== report.destination) {
    throw new Error(`Titre ${track.provider} choisi pour une destination ${report.destination}`);
  }

  let candidates = current.candidates;
  if (track && !candidates.some((c) => c.track.providerTrackId === track.providerTrackId)) {
    // Titre trouvé à la main : on l'ajoute aux candidats pour l'afficher avec son score.
    candidates = [scoreCandidate(current.source, track), ...candidates];
  }

  const updated: TrackMatch = { ...current, status: "manual", candidates, selected: track };
  const results = report.results.map((r, i) => (i === index ? updated : r));
  return { ...report, results, summary: summarize(results) };
}

/** Prépare la playlist à créer : titres sélectionnés, dans l'ordre, sans doublons. */
export function buildNewPlaylist(
  report: ConversionReport,
  meta: { name: string; description: string | null },
): NewPlaylist {
  const seen = new Set<string>();
  const trackIds: string[] = [];
  for (const r of report.results) {
    const id = r.selected?.providerTrackId;
    if (id && !seen.has(id)) {
      seen.add(id);
      trackIds.push(id);
    }
  }
  return { name: meta.name, description: meta.description, trackIds };
}

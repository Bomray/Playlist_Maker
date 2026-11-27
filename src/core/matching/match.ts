// Choix du meilleur candidat et classement trouvé / incertain / introuvable.
import type { Track } from "../models";
import { scoreCandidate, type ScoredCandidate } from "./score";

/** À partir de ce score, le titre est considéré comme trouvé et ajouté d'office. */
export const FOUND_THRESHOLD = 0.85;
/** Entre ce seuil et FOUND_THRESHOLD : incertain, l'utilisateur doit valider. */
export const UNCERTAIN_THRESHOLD = 0.5;
/** Nombre de candidats gardés pour la correction manuelle. */
export const MAX_CANDIDATES = 5;

/**
 * - `found` : correspondance fiable, sélectionnée automatiquement ;
 * - `uncertain` : un candidat plausible est proposé, mais pas sélectionné ;
 * - `not_found` : aucun candidat crédible (ou erreur sur ce titre) ;
 * - `manual` : choix fait (ou retiré) à la main par l'utilisateur.
 */
export type MatchStatus = "found" | "uncertain" | "not_found" | "manual";

export interface TrackMatch {
  source: Track;
  status: MatchStatus;
  /** Meilleur candidat, même s'il n'est pas sélectionné. */
  best: ScoredCandidate | null;
  /** Candidats triés par score décroissant (MAX_CANDIDATES au plus). */
  candidates: ScoredCandidate[];
  /** Titre qui sera ajouté à la playlist, ou `null` s'il ne l'est pas. */
  selected: Track | null;
  /** Erreur rencontrée en cherchant ce titre précis, le cas échéant. */
  error?: { kind: string; message: string };
}

export function statusFromScore(score: number): Exclude<MatchStatus, "manual"> {
  if (score >= FOUND_THRESHOLD) return "found";
  if (score >= UNCERTAIN_THRESHOLD) return "uncertain";
  return "not_found";
}

/** Note chaque candidat et décide du statut du titre source. */
export function matchTrack(source: Track, candidates: readonly Track[]): TrackMatch {
  const seen = new Set<string>();
  const scored = candidates
    .filter((c) => {
      // Une même piste peut revenir de plusieurs recherches successives.
      if (seen.has(c.providerTrackId)) return false;
      seen.add(c.providerTrackId);
      return true;
    })
    .map((c) => scoreCandidate(source, c))
    // Tri stable : à score égal, l'ordre de pertinence de la plateforme est conservé.
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_CANDIDATES);

  const best = scored[0] ?? null;
  const status = best ? statusFromScore(best.score) : "not_found";
  return {
    source,
    status,
    best,
    candidates: scored,
    selected: status === "found" && best ? best.track : null,
  };
}

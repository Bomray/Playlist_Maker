// Score de confiance d'un candidat pour un titre source.
import type { Track } from "../models";
import {
  EQUIVALENT_VERSIONS,
  normalizeText,
  parseTitle,
  splitArtists,
  type VersionTag,
} from "./normalize";
import { artistSimilarity, durationSimilarity, textSimilarity } from "./similarity";

/**
 * Poids des critères quand l'ISRC ne suffit pas. Le titre compte le plus ; l'artiste
 * départage les homonymes ; la durée confirme qu'il s'agit du même enregistrement.
 */
export const WEIGHTS = { title: 0.5, artist: 0.3, duration: 0.2 } as const;

/** Score maximal quand les versions diffèrent (remix contre original…) : jamais « trouvé ». */
export const VERSION_MISMATCH_CAP = 0.6;

export interface ScoreDetails {
  title: number;
  artist: number;
  /** `null` si une des deux durées est inconnue. */
  duration: number | null;
  versionMismatch: boolean;
}

export interface ScoredCandidate {
  track: Track;
  /** Entre 0 et 1. */
  score: number;
  method: "isrc" | "metadata";
  details: ScoreDetails;
}

function sameVersion(a: VersionTag | null, b: VersionTag | null): boolean {
  const ka = a && !EQUIVALENT_VERSIONS.has(a) ? a : null;
  const kb = b && !EQUIVALENT_VERSIONS.has(b) ? b : null;
  return ka === kb;
}

function normalizeIsrc(isrc: string | null): string | null {
  const s = isrc?.replace(/[^a-z0-9]/gi, "").toUpperCase();
  return s ? s : null;
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** Compare un candidat de la plateforme de destination au titre source. */
export function scoreCandidate(source: Track, candidate: Track): ScoredCandidate {
  const st = parseTitle(source.title);
  const ct = parseTitle(candidate.title);

  // Les invités cités dans le titre comptent comme artistes (« Titre (feat. X) »).
  const sArtists = splitArtists([...source.artists, ...st.featured]);
  const cArtists = splitArtists([...candidate.artists, ...ct.featured]);
  const sPrimary = source.artists[0] ? normalizeText(source.artists[0]) : undefined;

  const details: ScoreDetails = {
    title: round(textSimilarity(st.base, ct.base)),
    artist: round(artistSimilarity(sPrimary, sArtists, cArtists)),
    duration: durationSimilarity(source.durationMs, candidate.durationMs),
    versionMismatch: !sameVersion(st.version, ct.version),
  };
  if (details.duration !== null) details.duration = round(details.duration);

  const isrc = normalizeIsrc(source.isrc);
  if (isrc && isrc === normalizeIsrc(candidate.isrc)) {
    // Même ISRC = même enregistrement, quelle que soit l'écriture du titre.
    return { track: candidate, score: 1, method: "isrc", details };
  }

  let score: number;
  if (details.duration === null) {
    // Durée inconnue : on répartit son poids sur le titre et l'artiste.
    const total = WEIGHTS.title + WEIGHTS.artist;
    score = (WEIGHTS.title * details.title + WEIGHTS.artist * details.artist) / total;
  } else {
    score =
      WEIGHTS.title * details.title +
      WEIGHTS.artist * details.artist +
      WEIGHTS.duration * details.duration;
  }
  if (details.versionMismatch) score = Math.min(score, VERSION_MISMATCH_CAP);

  return { track: candidate, score: round(score), method: "metadata", details };
}

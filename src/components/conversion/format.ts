// Petits formats d'affichage du récapitulatif de conversion.
import type { MatchStatus } from "@/core/matching";
import type { ProviderId, Track } from "@/core/models";

export const PROVIDER_LABELS: Record<ProviderId, string> = {
  spotify: "Spotify",
  deezer: "Deezer",
  "youtube-music": "YouTube Music",
  soundcloud: "SoundCloud",
};

export function providerLabel(id: string): string {
  return id in PROVIDER_LABELS ? PROVIDER_LABELS[id as ProviderId] : id;
}

/** 207 000 ms → « 3:27 » ; `null` → « – ». */
export function formatDuration(ms: number | null): string {
  if (ms === null) return "–";
  const total = Math.round(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/** 0.923 → « 92 % » (espace insécable, typographie française). */
export function formatScore(score: number): string {
  return `${Math.round(score * 100)} %`;
}

export function artistsLabel(track: Track): string {
  return track.artists.join(", ") || "Artiste inconnu";
}

/** Statut de départ d'un titre : sert à le ranger dans une section du récapitulatif. */
export type InitialStatus = Exclude<MatchStatus, "manual">;

export const STATUS_LABELS: Record<InitialStatus, string> = {
  found: "Trouvé",
  uncertain: "Incertain",
  not_found: "Introuvable",
};

/** « 1 titre », « 2 titres » (0 reste au singulier en français). */
export function countLabel(n: number, word: string): string {
  return `${n} ${word}${n > 1 ? "s" : ""}`;
}

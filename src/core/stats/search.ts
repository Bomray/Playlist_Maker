// Recherche et tri dans les tops complets (logique pure).
import type { TopEntry } from "./aggregate";

export type TopMetric = "plays" | "msPlayed";

/** Minuscules sans accents : « beyonce » trouve « Beyoncé ». */
export function normalizeSearch(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("fr").trim();
}

export interface RankedEntry extends TopEntry {
  /** Rang dans le classement complet (avant la recherche). */
  rank: number;
}

/**
 * Classe toutes les entrées selon la mesure choisie, puis garde celles dont le nom (ou
 * l'artiste) contient chaque mot recherché. Le rang reste celui du classement complet.
 */
export function rankAndSearch(
  entries: readonly TopEntry[],
  metric: TopMetric,
  query: string,
): RankedEntry[] {
  const ranked = [...entries]
    .sort(
      (a, b) =>
        b[metric] - a[metric] ||
        (metric === "plays" ? b.msPlayed - a.msPlayed : b.plays - a.plays) ||
        a.label.localeCompare(b.label, "fr"),
    )
    .map((e, i) => ({ ...e, rank: i + 1 }));
  const words = normalizeSearch(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return ranked;
  return ranked.filter((e) => {
    const text = normalizeSearch(`${e.label} ${e.sublabel ?? ""}`);
    return words.every((w) => text.includes(w));
  });
}

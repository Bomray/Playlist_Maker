// Mesures de similarité entre 0 (rien à voir) et 1 (identique).

/**
 * Bigrammes de caractères d'un texte déjà normalisé, mot par mot (« ab cd » → ab, cd),
 * avec répétitions. Ne pas franchir les espaces rend l'ordre des mots indifférent.
 * Un mot d'une lettre compte comme un « bigramme » à lui seul.
 */
function bigrams(text: string): Map<string, number> {
  const counts = new Map<string, number>();
  const add = (bg: string) => counts.set(bg, (counts.get(bg) ?? 0) + 1);
  for (const word of text.split(" ")) {
    if (word.length === 1) add(word);
    for (let i = 0; i < word.length - 1; i++) add(word.slice(i, i + 2));
  }
  return counts;
}

/**
 * Coefficient de Dice sur les bigrammes : 2 × (bigrammes communs) / (total des deux).
 * Choisi plutôt qu'une distance d'édition car il tolère les mots déplacés
 * (« oli bigflo » / « bigflo oli ») et reste simple. Les textes doivent être normalisés.
 */
export function textSimilarity(a: string, b: string): number {
  if (a === b) return a.length > 0 ? 1 : 0;
  const ba = bigrams(a);
  const bb = bigrams(b);
  let common = 0;
  let total = 0;
  for (const [bg, n] of ba) {
    common += Math.min(n, bb.get(bg) ?? 0);
    total += n;
  }
  for (const n of bb.values()) total += n;
  return total === 0 ? 0 : (2 * common) / total;
}

/**
 * Similarité de deux listes d'artistes normalisés (voir `splitArtists`) :
 * meilleure correspondance trouvée pour l'artiste principal de la source.
 * Les featurings en plus ou en moins ne pénalisent pas : les plateformes ne les
 * renseignent pas toutes de la même façon.
 */
export function artistSimilarity(
  sourcePrimary: string | undefined,
  source: readonly string[],
  candidate: readonly string[],
): number {
  if (source.length === 0 || candidate.length === 0) return 0;
  const primaries = sourcePrimary ? [sourcePrimary] : source;
  let best = 0;
  for (const s of primaries) {
    for (const c of candidate) best = Math.max(best, textSimilarity(s, c));
  }
  // Repli : un autre artiste de la source correspond exactement (ex. duo écrit autrement).
  if (best < 1 && source.some((s) => candidate.includes(s))) best = Math.max(best, 0.9);
  return best;
}

/** Tolérance de CLAUDE.md : même durée à ±3 s près. */
export const DURATION_TOLERANCE_MS = 3_000;
/** Au-delà de cet écart, la durée ne plaide plus du tout pour la correspondance. */
export const DURATION_MAX_GAP_MS = 15_000;

/** 1 si l'écart ≤ 3 s, puis baisse linéaire jusqu'à 0 à 15 s ; `null` si une durée manque. */
export function durationSimilarity(a: number | null, b: number | null): number | null {
  if (a === null || b === null) return null;
  const gap = Math.abs(a - b);
  if (gap <= DURATION_TOLERANCE_MS) return 1;
  if (gap >= DURATION_MAX_GAP_MS) return 0;
  return 1 - (gap - DURATION_TOLERANCE_MS) / (DURATION_MAX_GAP_MS - DURATION_TOLERANCE_MS);
}

// Normalisation des titres et artistes avant comparaison.
// Les plateformes écrivent le même titre de façons différentes (accents, « feat. »,
// « - Remastered 2011 »…) : on ramène tout à une forme comparable.

/** Variantes d'un titre qui en font (ou non) un enregistrement différent. */
export type VersionTag = "remix" | "live" | "acoustic" | "instrumental" | "edit" | "remaster";

/**
 * Un remaster ou un « radio edit » reste le même morceau pour l'utilisateur ;
 * un remix, un live, une version acoustique ou instrumentale, non.
 */
export const EQUIVALENT_VERSIONS: ReadonlySet<VersionTag> = new Set(["remaster", "edit"]);

export interface ParsedTitle {
  /** Titre normalisé, sans featurings ni mention de version. */
  base: string;
  /** Artistes invités cités dans le titre, normalisés. */
  featured: string[];
  version: VersionTag | null;
}

/** Minuscules, sans accents ni ponctuation, « & / et / and » unifiés. */
export function normalizeText(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/œ/g, "oe")
      .replace(/æ/g, "ae")
      .replace(/ß/g, "ss")
      .normalize("NFD")
      // Retire les diacritiques (accents) séparés par NFD.
      .replace(/[̀-ͯ]/g, "")
      .replace(/&/g, " and ")
      .replace(/\bet\b/g, " and ")
      // Apostrophes collées (« don't » → « dont ») plutôt que remplacées par un espace.
      .replace(/['’`]/g, "")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

const VERSION_PATTERNS: ReadonlyArray<[VersionTag, RegExp]> = [
  ["remix", /\b(remix|rmx|mix|bootleg|rework|vip)\b/],
  ["live", /\b(live|en concert|en direct)\b/],
  ["acoustic", /\b(acoustic|acoustique|unplugged)\b/],
  ["instrumental", /\b(instrumental|karaoke)\b/],
  ["remaster", /\b(remaster|remastered|remasterise|remasterisee)\b/],
  ["edit", /\b(radio edit|edit|single version|radio version|clean|explicit)\b/],
];

function detectVersion(normalized: string): VersionTag | null {
  for (const [tag, pattern] of VERSION_PATTERNS) {
    if (pattern.test(normalized)) return tag;
  }
  return null;
}

const FEAT = /^(feat|ft|featuring|with|avec)\b\.?\s*/i;

/**
 * Sépare un titre en titre de base, artistes invités et version.
 * Ex. : « Hide (feat. Seezyn) - Remastered 2011 » → base « hide »,
 * featured ["seezyn"], version « remaster ».
 */
export function parseTitle(title: string): ParsedTitle {
  const featured: string[] = [];
  let version: VersionTag | null = null;
  let rest = title;

  // Parties entre parenthèses ou crochets : featuring, version, ou à garder.
  rest = rest.replace(/[([]([^)\]]*)[)\]]/g, (whole, inner: string) => {
    const trimmed = inner.trim();
    if (FEAT.test(trimmed)) {
      featured.push(...splitArtistString(trimmed.replace(FEAT, "")));
      return " ";
    }
    const tag = detectVersion(normalizeText(trimmed));
    if (tag) {
      version ??= tag;
      return " ";
    }
    return whole;
  });

  // « Titre - Remastered 2011 », « Titre - Live at Wembley ».
  const dash = /\s[-–—]\s(.+)$/.exec(rest);
  if (dash?.[1]) {
    const tag = detectVersion(normalizeText(dash[1]));
    if (tag) {
      version ??= tag;
      rest = rest.slice(0, dash.index);
    }
  }

  // « Titre feat. X » sans parenthèses.
  const inlineFeat = /\s(?:feat\.?|ft\.?|featuring)\s+(.+)$/i.exec(rest);
  if (inlineFeat?.[1]) {
    featured.push(...splitArtistString(inlineFeat[1]));
    rest = rest.slice(0, inlineFeat.index);
  }

  return { base: normalizeText(rest), featured, version };
}

/** Découpe « A & B », « A, B », « A feat. B », « A x B » en artistes normalisés. */
function splitArtistString(text: string): string[] {
  return text
    .split(/\s*(?:,|&|\+|\/|;|\bfeat\.?|\bft\.?|\bfeaturing\b|\bwith\b|\bx\b|\bet\b|\band\b)\s*/i)
    .map(normalizeText)
    .filter((a) => a.length > 0);
}

/**
 * Liste d'artistes normalisés, en gardant aussi la forme d'origine entière :
 * « Bigflo & Oli » donne ["bigflo and oli", "bigflo", "oli"], ce qui permet
 * de le rapprocher de ["Bigflo", "Oli"] comme de ["Bigflo & Oli"].
 */
export function splitArtists(artists: readonly string[]): string[] {
  const out = new Set<string>();
  for (const artist of artists) {
    const whole = normalizeText(artist);
    if (whole) out.add(whole);
    for (const part of splitArtistString(artist)) out.add(part);
  }
  return [...out];
}

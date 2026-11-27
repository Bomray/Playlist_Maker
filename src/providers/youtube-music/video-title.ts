// Les titres YouTube décrivent des vidéos, pas des morceaux : on en extrait titre et artiste.

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&lt;": "<",
  "&gt;": ">",
};

/** Certaines réponses YouTube (recherche notamment) échappent le HTML : « Bigflo &amp; Oli ». */
export function decodeEntities(text: string): string {
  return text.replace(/&(amp|quot|#39|apos|lt|gt);/g, (m) => ENTITIES[m] ?? m);
}

// Mentions de clip qui ne font pas partie du titre du morceau.
const NOISE =
  /\b(official|officiel(le)?|clip|music video|video|vidéo|audio|lyrics?|paroles|visuali[sz]er|hd|hq|4k|mv)\b/i;

/** Retire « (Clip Officiel) », « [Official Audio] », « | Live session »… */
function stripNoise(title: string): string {
  return title
    .replace(/\s*[([]([^)\]]*)[)\]]/g, (whole, inner: string) => (NOISE.test(inner) ? "" : whole))
    .replace(/\s+\|.*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** « NFVEVO » → « NF », « Orelsan Officiel » → « Orelsan ». */
function cleanChannel(channel: string): string {
  return channel
    .replace(/VEVO$/i, "")
    .replace(/\s+(official|officiel)$/i, "")
    .trim();
}

export interface ParsedVideo {
  title: string;
  artists: string[];
}

/**
 * - Chaîne « Artiste - Topic » (titres « audio » de YouTube Music) : fiable, on garde le
 *   titre tel quel (vérifié sur 11/11 titres pendant le spike 2).
 * - Sinon, clip classique « Artiste - Titre (Clip officiel) » : on coupe au premier tiret.
 * - Sinon, l'artiste est la chaîne.
 */
export function parseVideoTitle(rawTitle: string, rawChannel: string | undefined): ParsedVideo {
  const title = decodeEntities(rawTitle).trim();
  const channel = rawChannel ? decodeEntities(rawChannel).trim() : "";

  if (channel.endsWith(" - Topic")) {
    return { title, artists: [channel.replace(/ - Topic$/, "")] };
  }
  const dash = /^(.+?)\s[-–—]\s(.+)$/.exec(title);
  if (dash?.[1] && dash[2]) {
    return { title: stripNoise(dash[2]), artists: [dash[1].trim()] };
  }
  return { title: stripNoise(title), artists: channel ? [cleanChannel(channel)] : [] };
}

/** « PT3M30S » → 210 000 ms ; `null` si le format est inattendu (direct, P1D…). */
export function isoDurationMs(iso: string): number | null {
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!m || iso === "PT") return null;
  return ((Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0)) * 60 + Number(m[3] ?? 0)) * 1000;
}

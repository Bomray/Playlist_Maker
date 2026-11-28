// Calcul des statistiques d'écoute à partir des lectures (logique pure, sans navigateur).
import type { Play } from "./parse";
import { matchesSelection, type Selection } from "./selection";

/** Comme Spotify, une lecture ne compte comme « écoute » qu'à partir de 30 secondes. */
export const MIN_PLAY_MS = 30_000;
export const TOP_LIMIT = 50;

export interface TopEntry {
  key: string;
  label: string;
  /** Artiste (pour un titre ou un album). */
  sublabel: string | null;
  plays: number;
  msPlayed: number;
}

export interface Bucket {
  key: string;
  plays: number;
  msPlayed: number;
}

export interface Stats {
  music: {
    msPlayed: number;
    plays: number;
    /** Lectures de moins de 30 s (titres passés). */
    shortPlays: number;
    distinctTracks: number;
    distinctArtists: number;
    /** Jours (dans le fuseau choisi) avec au moins une écoute. */
    activeDays: number;
  };
  podcasts: { msPlayed: number; episodes: number };
  /** Première et dernière lecture de la période (ms UTC), `null` si aucune. */
  range: { first: number; last: number } | null;
  topTracks: TopEntry[];
  topArtists: TopEntry[];
  topAlbums: TopEntry[];
  byYear: Bucket[];
  /** Clé « 2024-03 ». */
  byMonth: Bucket[];
  /** Clé « 2024-03-14 », seulement les jours avec au moins une lecture. */
  byDay: Bucket[];
  /** Index 0 = lundi … 6 = dimanche. */
  byWeekday: Bucket[];
  /** Index 0 … 23. */
  byHour: Bucket[];
}

export interface StatsOptions {
  /** Bornes incluses, en ms UTC. */
  from?: number;
  to?: number;
  /** Fuseau IANA pour les heures et les jours (ex. « Europe/Paris »). */
  timeZone: string;
  /** Seulement les écoutes d'un artiste, d'un album ou d'un titre (pages de détail). */
  selection?: Selection;
  /** Taille des tops (par écoutes et par temps) ; `Infinity` pour tout garder (tops complets). */
  topLimit?: number;
}

interface LocalParts {
  year: string;
  month: string;
  day: string;
  weekday: number;
  hour: number;
}

const WEEKDAYS: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
const HOUR_MS = 3_600_000;
// Tous les fuseaux sont décalés d'un multiple de 15 min (Inde +5:30, Népal +5:45…).
const SLOT_MS = 15 * 60_000;

/**
 * Convertit une date UTC en année / mois / jour / jour de semaine / heure locaux.
 * Les décalages sont des multiples de 15 min et changent sur ces mêmes tranches : on met
 * en cache le résultat par tranche de 15 min (bien moins d'appels à Intl qu'une par lecture).
 */
function localPartsCache(timeZone: string): (t: number) => LocalParts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    hourCycle: "h23",
  });
  const cache = new Map<number, LocalParts>();
  return (t) => {
    const slot = Math.floor(t / SLOT_MS);
    let parts = cache.get(slot);
    if (!parts) {
      const p = Object.fromEntries(fmt.formatToParts(slot * SLOT_MS).map((x) => [x.type, x.value]));
      parts = {
        year: p.year ?? "",
        month: p.month ?? "",
        day: p.day ?? "",
        weekday: WEEKDAYS[p.weekday ?? ""] ?? 0,
        hour: Number(p.hour ?? 0) % 24,
      };
      cache.set(slot, parts);
    }
    return parts;
  };
}

function add(map: Map<string, Bucket>, key: string, ms: number, counted: boolean): void {
  const b = map.get(key) ?? { key, plays: 0, msPlayed: 0 };
  b.msPlayed += ms;
  if (counted) b.plays++;
  map.set(key, b);
}

function addTop(
  map: Map<string, TopEntry>,
  key: string,
  label: string,
  sublabel: string | null,
  ms: number,
  counted: boolean,
): void {
  const e = map.get(key) ?? { key, label, sublabel, plays: 0, msPlayed: 0 };
  e.msPlayed += ms;
  if (counted) e.plays++;
  map.set(key, e);
}

/**
 * Union des 50 premiers par écoutes et des 50 premiers par temps d'écoute (≤ 100 entrées),
 * triée par écoutes : l'affichage peut ainsi trier par l'un ou l'autre sans en oublier.
 */
function top(map: Map<string, TopEntry>, limit: number): TopEntry[] {
  const all = [...map.values()];
  const byPlays = [...all].sort(
    (a, b) => b.plays - a.plays || b.msPlayed - a.msPlayed || a.label.localeCompare(b.label),
  );
  const byTime = [...all].sort((a, b) => b.msPlayed - a.msPlayed || b.plays - a.plays);
  if (limit >= all.length) return byPlays;
  const keep = new Set([...byPlays.slice(0, limit), ...byTime.slice(0, limit)]);
  return byPlays.filter((e) => keep.has(e));
}

function sortedBuckets(map: Map<string, Bucket>): Bucket[] {
  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
}

function fixedBuckets(map: Map<string, Bucket>, size: number): Bucket[] {
  return Array.from(
    { length: size },
    (_, i) => map.get(String(i)) ?? { key: String(i), plays: 0, msPlayed: 0 },
  );
}

export function computeStats(
  plays: readonly Play[],
  { from, to, timeZone, selection, topLimit = TOP_LIMIT }: StatsOptions,
): Stats {
  const local = localPartsCache(timeZone);
  const tracks = new Map<string, TopEntry>();
  const artists = new Map<string, TopEntry>();
  const albums = new Map<string, TopEntry>();
  const years = new Map<string, Bucket>();
  const months = new Map<string, Bucket>();
  const dayBuckets = new Map<string, Bucket>();
  const weekdays = new Map<string, Bucket>();
  const hours = new Map<string, Bucket>();
  const days = new Set<string>();
  const stats: Stats["music"] = {
    msPlayed: 0,
    plays: 0,
    shortPlays: 0,
    distinctTracks: 0,
    distinctArtists: 0,
    activeDays: 0,
  };
  const podcasts = { msPlayed: 0, episodes: 0 };
  let first = Infinity;
  let last = -Infinity;

  for (const p of plays) {
    if ((from !== undefined && p.endedAt < from) || (to !== undefined && p.endedAt > to)) continue;
    if (selection && !matchesSelection(p, selection)) continue;
    first = Math.min(first, p.endedAt);
    last = Math.max(last, p.endedAt);
    const counted = p.msPlayed >= MIN_PLAY_MS;

    if (p.kind === "podcast") {
      podcasts.msPlayed += p.msPlayed;
      if (counted) podcasts.episodes++;
      continue;
    }

    stats.msPlayed += p.msPlayed;
    if (counted) stats.plays++;
    else stats.shortPlays++;

    // Sans URI (format « compte »), un titre est identifié par artiste + titre.
    addTop(tracks, p.uri ?? `${p.artist}\u0000${p.title}`, p.title, p.artist, p.msPlayed, counted);
    addTop(artists, p.artist, p.artist, null, p.msPlayed, counted);
    if (p.album)
      addTop(albums, `${p.artist}\u0000${p.album}`, p.album, p.artist, p.msPlayed, counted);

    const l = local(p.endedAt);
    add(years, l.year, p.msPlayed, counted);
    add(months, `${l.year}-${l.month}`, p.msPlayed, counted);
    add(dayBuckets, `${l.year}-${l.month}-${l.day}`, p.msPlayed, counted);
    add(weekdays, String(l.weekday), p.msPlayed, counted);
    add(hours, String(l.hour), p.msPlayed, counted);
    if (counted) days.add(`${l.year}-${l.month}-${l.day}`);
  }

  stats.distinctTracks = tracks.size;
  stats.distinctArtists = artists.size;
  stats.activeDays = days.size;

  return {
    music: stats,
    podcasts,
    range: first === Infinity ? null : { first, last },
    topTracks: top(tracks, topLimit),
    topArtists: top(artists, topLimit),
    topAlbums: top(albums, topLimit),
    byYear: sortedBuckets(years),
    byMonth: sortedBuckets(months),
    byDay: sortedBuckets(dayBuckets),
    byWeekday: fixedBuckets(weekdays, 7),
    byHour: fixedBuckets(hours, 24),
  };
}

/** Durée en minutes, heures et jours (arrondis), pour l'affichage. */
export function splitDuration(ms: number): { minutes: number; hours: number; days: number } {
  return {
    minutes: Math.round(ms / 60_000),
    hours: Math.round(ms / HOUR_MS),
    days: Math.round((ms / (24 * HOUR_MS)) * 10) / 10,
  };
}

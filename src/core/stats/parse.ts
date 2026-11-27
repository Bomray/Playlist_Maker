// Lecture des exports Spotify (« Historique de streaming étendu » et « Données du compte »).
// Seuls les champs utiles aux stats sont gardés : IP, pays, appareil… sont ignorés dès ici.
import { z } from "zod";

/** Une lecture, quel que soit le format d'export d'origine. */
export interface Play {
  /** Fin de la lecture, en millisecondes depuis 1970 (UTC). */
  endedAt: number;
  msPlayed: number;
  kind: "music" | "podcast";
  /** Titre du morceau, ou de l'épisode pour un podcast. */
  title: string;
  /** Artiste, ou nom de l'émission pour un podcast. */
  artist: string;
  album: string | null;
  /** URI Spotify (`spotify:track:…`) quand l'export le donne. */
  uri: string | null;
  skipped: boolean | null;
}

// Format « étendu » (Streaming_History_Audio_*.json, Streaming_History_Video_*.json).
// Zod ignore les clés non déclarées : ip_addr, conn_country… ne sont jamais conservées.
const ExtendedEntry = z.object({
  ts: z.string(),
  ms_played: z.number().int().nonnegative(),
  master_metadata_track_name: z.string().nullish(),
  master_metadata_album_artist_name: z.string().nullish(),
  master_metadata_album_album_name: z.string().nullish(),
  spotify_track_uri: z.string().nullish(),
  episode_name: z.string().nullish(),
  episode_show_name: z.string().nullish(),
  skipped: z.boolean().nullish(),
});

// Format « Données du compte » (StreamingHistory_music_*.json, StreamingHistory_podcast_*.json).
// `endTime` est en UTC, au format « 2024-01-31 23:59 ».
const AccountMusicEntry = z.object({
  endTime: z.string(),
  msPlayed: z.number().int().nonnegative(),
  artistName: z.string(),
  trackName: z.string(),
});
const AccountPodcastEntry = z.object({
  endTime: z.string(),
  msPlayed: z.number().int().nonnegative(),
  podcastName: z.string(),
  episodeName: z.string(),
});

export interface ParseResult {
  plays: Play[];
  /** Entrées ignorées : format inconnu, date invalide, ou ni morceau ni épisode (livre audio…). */
  skippedEntries: number;
}

function parseDate(value: string): number | null {
  // « 2024-01-31 23:59 » (format compte) → ISO UTC.
  const iso = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(value)
    ? `${value.replace(" ", "T")}:00Z`
    : value;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
}

function fromExtended(e: z.infer<typeof ExtendedEntry>): Play | null {
  const endedAt = parseDate(e.ts);
  if (endedAt === null) return null;
  const common = { endedAt, msPlayed: e.ms_played, skipped: e.skipped ?? null };
  if (e.master_metadata_track_name) {
    return {
      ...common,
      kind: "music",
      title: e.master_metadata_track_name,
      artist: e.master_metadata_album_artist_name ?? "Artiste inconnu",
      album: e.master_metadata_album_album_name ?? null,
      uri: e.spotify_track_uri ?? null,
    };
  }
  if (e.episode_name) {
    return {
      ...common,
      kind: "podcast",
      title: e.episode_name,
      artist: e.episode_show_name ?? "Podcast",
      album: null,
      uri: null,
    };
  }
  return null;
}

function fromEntry(raw: unknown): Play | null {
  const ext = ExtendedEntry.safeParse(raw);
  if (ext.success) return fromExtended(ext.data);
  const music = AccountMusicEntry.safeParse(raw);
  if (music.success) {
    const endedAt = parseDate(music.data.endTime);
    if (endedAt === null) return null;
    return {
      endedAt,
      msPlayed: music.data.msPlayed,
      kind: "music",
      title: music.data.trackName,
      artist: music.data.artistName,
      album: null,
      uri: null,
      skipped: null,
    };
  }
  const podcast = AccountPodcastEntry.safeParse(raw);
  if (podcast.success) {
    const endedAt = parseDate(podcast.data.endTime);
    if (endedAt === null) return null;
    return {
      endedAt,
      msPlayed: podcast.data.msPlayed,
      kind: "podcast",
      title: podcast.data.episodeName,
      artist: podcast.data.podcastName,
      album: null,
      uri: null,
      skipped: null,
    };
  }
  return null;
}

/**
 * Lit le contenu (déjà décodé en JSON) d'un fichier d'export : un tableau d'entrées.
 * Une entrée invalide est comptée dans `skippedEntries` plutôt que de tout faire échouer.
 */
export function parseExportFile(json: unknown): ParseResult {
  if (!Array.isArray(json)) return { plays: [], skippedEntries: 0 };
  const plays: Play[] = [];
  let skippedEntries = 0;
  for (const raw of json) {
    const play = fromEntry(raw);
    if (play) plays.push(play);
    else skippedEntries++;
  }
  return { plays, skippedEntries };
}

/** Fichiers d'historique d'écoute dans une archive d'export (le reste est ignoré). */
export function isHistoryFileName(path: string): boolean {
  const name = path.split("/").pop() ?? "";
  return /^(Streaming_History_(Audio|Video)_.*|StreamingHistory_?(music|podcast)?_?\d*)\.json$/i.test(
    name,
  );
}

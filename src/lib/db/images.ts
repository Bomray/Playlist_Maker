// Images des morceaux, albums et artistes en base : ce qu'il reste à chercher, ce qu'on a
// trouvé, et la lecture pour l'affichage.
import { z } from "zod";
import type { Db } from "./types";

export interface TrackToFill {
  id: number;
  /** Identifiant Spotify du morceau (fin de l'URI « spotify:track:… »). */
  spotifyId: string;
  artist: string;
}

/**
 * Morceaux Spotify pas encore cherchés, les plus écoutés d'abord : avec un gros historique,
 * le remplissage prend plusieurs heures, autant commencer par ce qui s'affiche dans les tops.
 */
export async function tracksToFill(db: Db, limit: number): Promise<TrackToFill[]> {
  const rows = await db.query(
    `SELECT t.id, t.uri, t.artist
     FROM tracks t
     LEFT JOIN plays p ON p.track_id = t.id
     WHERE t.images_checked_at IS NULL AND t.kind = 'music' AND t.uri LIKE 'spotify:track:%'
     GROUP BY t.id
     ORDER BY count(p.track_id) DESC, t.id
     LIMIT $1`,
    [limit],
  );
  return z
    .array(z.object({ id: z.coerce.number(), uri: z.string(), artist: z.string() }))
    .parse(rows)
    .map((r) => ({ id: r.id, spotifyId: r.uri.slice("spotify:track:".length), artist: r.artist }));
}

/** Résultat de la recherche d'un morceau (`null` partout si Spotify ne le connaît pas). */
export async function saveTrackImage(
  db: Db,
  track: TrackToFill,
  found: { imageUrl: string | null; artistSpotifyId: string | null },
): Promise<void> {
  await db.query(
    `UPDATE tracks SET image_url = $2, artist_spotify_id = $3, images_checked_at = now()
     WHERE id = $1`,
    [track.id, found.imageUrl, found.artistSpotifyId],
  );
  if (found.artistSpotifyId) {
    await db.query(
      `INSERT INTO artists (name, spotify_id) VALUES ($1, $2)
       ON CONFLICT (name) DO UPDATE SET spotify_id = COALESCE(artists.spotify_id, EXCLUDED.spotify_id)`,
      [track.artist, found.artistSpotifyId],
    );
  }
}

export async function artistsToFill(
  db: Db,
  limit: number,
): Promise<{ name: string; spotifyId: string }[]> {
  const rows = await db.query(
    `SELECT name, spotify_id FROM artists
     WHERE checked_at IS NULL AND spotify_id IS NOT NULL
     ORDER BY name LIMIT $1`,
    [limit],
  );
  return z
    .array(z.object({ name: z.string(), spotify_id: z.string() }))
    .parse(rows)
    .map((r) => ({ name: r.name, spotifyId: r.spotify_id }));
}

export async function saveArtistImage(
  db: Db,
  name: string,
  imageUrl: string | null,
): Promise<void> {
  await db.query(`UPDATE artists SET image_url = $2, checked_at = now() WHERE name = $1`, [
    name,
    imageUrl,
  ]);
}

export interface ImageRequest {
  /** `key` : clé du top (URI, ou artiste + titre sans URI). */
  tracks: { key: string; artist: string; title: string }[];
  artists: string[];
  albums: { key: string; artist: string; album: string }[];
}

export interface ImageMap {
  tracks: Record<string, string>;
  artists: Record<string, string>;
  albums: Record<string, string>;
}

const KeyUrl = z.array(z.object({ key: z.string(), image_url: z.string() }));
const NumUrl = z.array(z.object({ n: z.coerce.number(), image_url: z.string() }));

/**
 * Les clés des tops peuvent contenir le caractère nul (séparateur artiste / titre), que
 * PostgreSQL refuse : on envoie les entrées sans leur clé et on les retrouve par leur rang.
 */
function byRank(rows: unknown, keys: readonly string[]): Record<string, string> {
  return Object.fromEntries(
    NumUrl.parse(rows).flatMap((r) => {
      const key = keys[r.n - 1];
      return key === undefined ? [] : [[key, r.image_url]];
    }),
  );
}

/** Adresses des images connues pour les entrées demandées (les autres sont absentes). */
export async function findImages(db: Db, req: ImageRequest): Promise<ImageMap> {
  const [tracks, artists, albums] = await Promise.all([
    req.tracks.length === 0
      ? []
      : db.query(
          `SELECT DISTINCT ON (i.n) i.n, t.image_url
           FROM unnest($1::text[], $2::text[], $3::text[]) WITH ORDINALITY AS i(uri, artist, title, n)
           JOIN tracks t ON t.track_key = i.uri OR (t.artist = i.artist AND t.title = i.title)
           WHERE t.image_url IS NOT NULL
           ORDER BY i.n, (t.track_key = i.uri) DESC`,
          [
            req.tracks.map((t) => (t.key.startsWith("spotify:") ? t.key : "")),
            req.tracks.map((t) => t.artist),
            req.tracks.map((t) => t.title),
          ],
        ),
    req.artists.length === 0
      ? []
      : db.query(
          `SELECT name AS key, image_url FROM artists
           WHERE name = ANY($1::text[]) AND image_url IS NOT NULL`,
          [req.artists],
        ),
    req.albums.length === 0
      ? []
      : db.query(
          `SELECT DISTINCT ON (i.n) i.n, t.image_url
           FROM unnest($1::text[], $2::text[]) WITH ORDINALITY AS i(artist, album, n)
           JOIN tracks t ON t.artist = i.artist AND t.album = i.album
           WHERE t.image_url IS NOT NULL
           ORDER BY i.n`,
          [req.albums.map((a) => a.artist), req.albums.map((a) => a.album)],
        ),
  ]);
  return {
    tracks: byRank(
      tracks,
      req.tracks.map((t) => t.key),
    ),
    artists: Object.fromEntries(KeyUrl.parse(artists).map((r) => [r.key, r.image_url])),
    albums: byRank(
      albums,
      req.albums.map((a) => a.key),
    ),
  };
}

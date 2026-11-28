-- Images Spotify (spike 3) : on garde l'adresse des images (CDN i.scdn.co), pas les fichiers.
-- Remplies en tâche de fond par POST /api/cron/images.

-- Pochette de l'album du morceau, et identifiant Spotify de son artiste (pour sa photo).
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS artist_spotify_id text;
-- Date de la recherche d'image : renseignée même sans résultat, pour ne pas réessayer en boucle.
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS images_checked_at timestamptz;

-- Artistes, identifiés par le nom affiché dans les stats (celui de l'export).
CREATE TABLE IF NOT EXISTS artists (
  name text PRIMARY KEY,
  spotify_id text,
  image_url text,
  checked_at timestamptz
);

-- Recherche d'images par artiste + titre (exports sans URI) et par artiste + album.
CREATE INDEX IF NOT EXISTS tracks_artist_title ON tracks (artist, title);
CREATE INDEX IF NOT EXISTS tracks_artist_album ON tracks (artist, album);

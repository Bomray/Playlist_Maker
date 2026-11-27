-- Historique d'écoute (décision 0002) : morceaux partagés entre utilisateurs, et écoutes.
-- Données minimales : jamais d'IP, de pays ni d'appareil.

CREATE TABLE IF NOT EXISTS tracks (
  id bigserial PRIMARY KEY,
  -- URI Spotify quand il est connu, sinon « type + artiste + titre » (export sans URI).
  track_key text NOT NULL UNIQUE,
  uri text,
  title text NOT NULL,
  artist text NOT NULL,
  album text,
  kind text NOT NULL CHECK (kind IN ('music', 'podcast'))
);

CREATE TABLE IF NOT EXISTS plays (
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  track_id bigint NOT NULL REFERENCES tracks (id),
  -- Fin de la lecture (champ `ts` de l'export).
  ended_at timestamptz NOT NULL,
  ms_played integer NOT NULL CHECK (ms_played >= 0),
  -- 'import' : export Spotify ; 'api' : enregistrement continu (`recently-played`).
  source text NOT NULL CHECK (source IN ('import', 'api')),
  skipped boolean,
  -- `offline_timestamp` de l'export (0 si absent) : distingue les écoutes hors ligne
  -- synchronisées ensemble, qui partagent la même date de fin.
  offline_ts bigint NOT NULL DEFAULT 0,
  -- Une même écoute n'est jamais comptée deux fois, même après plusieurs imports. Mesuré sur
  -- un export réel de 290 129 lignes : cette clé n'écarte que 44 lignes, dont 36 strictement
  -- identiques (une clé sans durée ni horodatage hors ligne en écartait 221).
  PRIMARY KEY (user_id, ended_at, track_id, ms_played, offline_ts)
);

-- Utilisateurs connectés avec Spotify (décision 0002).
-- Les tokens sont chiffrés par l'appli (AES-256-GCM, TOKEN_ENCRYPTION_KEY) avant d'arriver ici :
-- la base ne voit jamais un token en clair.
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spotify_user_id text NOT NULL UNIQUE,
  display_name text,
  access_token_enc text NOT NULL,
  refresh_token_enc text NOT NULL,
  token_expires_at timestamptz NOT NULL,
  scope text NOT NULL DEFAULT '',
  -- Enregistrement continu des écoutes (PR suivantes) : accord explicite, curseur, erreurs.
  collecting boolean NOT NULL DEFAULT false,
  last_collected_at timestamptz,
  collect_cursor bigint,
  last_collect_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

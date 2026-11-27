// Table `users` : requêtes SQL paramétrées et validation Zod des lignes lues.
import { z } from "zod";
import type { Db } from "./types";

export interface StoredTokens {
  /** Tokens déjà chiffrés par l'appelant (la base ne voit jamais un token en clair). */
  accessTokenEnc: string;
  refreshTokenEnc: string;
  expiresAt: Date;
  scope: string;
}

const UserRow = z.object({
  id: z.string(),
  spotify_user_id: z.string(),
  display_name: z.string().nullable(),
  access_token_enc: z.string(),
  refresh_token_enc: z.string(),
  // PGlite renvoie un Date, le pilote Neon une chaîne ISO : on accepte les deux.
  token_expires_at: z.union([z.date(), z.string()]).transform((v) => new Date(v)),
  scope: z.string(),
  collecting: z.boolean(),
});

export type User = z.infer<typeof UserRow>;

const COLUMNS =
  "id, spotify_user_id, display_name, access_token_enc, refresh_token_enc, token_expires_at, scope, collecting";

function one(rows: Record<string, unknown>[]): User | null {
  return rows[0] ? UserRow.parse(rows[0]) : null;
}

/** Crée l'utilisateur à sa première connexion, ou met à jour son nom et ses tokens. */
export async function upsertUser(
  db: Db,
  input: { spotifyUserId: string; displayName: string | null; tokens: StoredTokens },
): Promise<User> {
  const { tokens } = input;
  const rows = await db.query(
    `INSERT INTO users (spotify_user_id, display_name, access_token_enc, refresh_token_enc, token_expires_at, scope)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (spotify_user_id) DO UPDATE SET
       display_name = EXCLUDED.display_name,
       access_token_enc = EXCLUDED.access_token_enc,
       refresh_token_enc = EXCLUDED.refresh_token_enc,
       token_expires_at = EXCLUDED.token_expires_at,
       scope = EXCLUDED.scope,
       updated_at = now()
     RETURNING ${COLUMNS}`,
    [
      input.spotifyUserId,
      input.displayName,
      tokens.accessTokenEnc,
      tokens.refreshTokenEnc,
      tokens.expiresAt,
      tokens.scope,
    ],
  );
  const user = one(rows);
  if (!user) throw new Error("upsertUser : aucune ligne renvoyée");
  return user;
}

export async function findUserById(db: Db, id: string): Promise<User | null> {
  // Un identifiant mal formé (cookie bricolé) ne doit pas faire échouer la requête SQL.
  if (!z.uuid().safeParse(id).success) return null;
  return one(await db.query(`SELECT ${COLUMNS} FROM users WHERE id = $1`, [id]));
}

export async function updateTokens(db: Db, id: string, tokens: StoredTokens): Promise<void> {
  await db.query(
    `UPDATE users SET access_token_enc = $2, refresh_token_enc = $3, token_expires_at = $4, scope = $5, updated_at = now()
     WHERE id = $1`,
    [id, tokens.accessTokenEnc, tokens.refreshTokenEnc, tokens.expiresAt, tokens.scope],
  );
}

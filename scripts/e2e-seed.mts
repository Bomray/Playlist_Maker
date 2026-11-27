// Prépare la base PGlite des tests de bout en bout : schéma à jour et un utilisateur
// connecté (tokens factices chiffrés). Lancé par Playwright avant le serveur de test.
import { rmSync } from "node:fs";
import { readdirSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { E2E_DB_DIR, E2E_SCOPES, E2E_TOKEN_KEY, E2E_USER_ID } from "../e2e/env.ts";
import { seal } from "../src/lib/crypto-box.ts";
import { applyMigrations } from "../src/lib/db/migrate.ts";

rmSync(E2E_DB_DIR, { recursive: true, force: true });
const pg = new PGlite(E2E_DB_DIR);
const db = {
  query: async (text: string, params: unknown[] = []) =>
    (await pg.query<Record<string, unknown>>(text, params)).rows,
};

const dir = new URL("../db/migrations/", import.meta.url);
await applyMigrations(
  db,
  readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .map((name) => ({ name, sql: readFileSync(new URL(name, dir), "utf8") })),
);
await db.query(
  `INSERT INTO users (id, spotify_user_id, display_name, access_token_enc, refresh_token_enc, token_expires_at, scope)
   VALUES ($1, 'e2e-user', 'Testeur', $2, $3, now() + interval '1 day', $4)`,
  [
    E2E_USER_ID,
    seal("faux-access", E2E_TOKEN_KEY),
    seal("faux-refresh", E2E_TOKEN_KEY),
    E2E_SCOPES,
  ],
);
await pg.close();
console.log(`Base e2e prête (${E2E_DB_DIR}).`);

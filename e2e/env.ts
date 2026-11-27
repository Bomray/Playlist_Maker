// Configuration du serveur des tests de bout en bout : valeurs factices, indépendantes
// du .env.local. Partagée par playwright.config.ts, le script de préparation et les tests.
export const E2E_PORT = 3100;
export const E2E_BASE_URL = `http://127.0.0.1:${E2E_PORT}`;
export const E2E_DB_DIR = ".e2e-db";
export const E2E_SESSION_SECRET = "secret-de-session-des-tests-e2e-0123456789";
export const E2E_TOKEN_KEY = "cle-des-tokens-des-tests-e2e-0123456789";
/** Utilisateur connecté des tests (créé par scripts/e2e-seed.mts). */
export const E2E_USER_ID = "00000000-0000-4000-8000-0000000000e2";
export const E2E_SCOPES =
  "playlist-modify-private playlist-read-private user-read-private user-read-recently-played";

export const E2E_SERVER_ENV = {
  DATABASE_URL: `pglite:${E2E_DB_DIR}`,
  SESSION_SECRET: E2E_SESSION_SECRET,
  TOKEN_ENCRYPTION_KEY: E2E_TOKEN_KEY,
  SPOTIFY_CLIENT_ID: "client-e2e",
  SPOTIFY_REDIRECT_URI: `${E2E_BASE_URL}/callback`,
};

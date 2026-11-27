import { defineConfig, devices } from "@playwright/test";
import { E2E_BASE_URL, E2E_PORT, E2E_SERVER_ENV } from "./e2e/env";

// Serveur dédié aux tests (port 3100) avec une base PGlite locale préremplie : les tests
// ne dépendent ni du .env.local ni d'une vraie base. Arrêter `pnpm dev` avant de les lancer
// (Next.js n'accepte qu'un serveur de dev à la fois dans un même dossier).
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // Une nouvelle tentative en local : sur un serveur de dev qui démarre, la compilation à la
  // demande (pages, worker de stats) peut dépasser les délais quand les tests tournent en
  // parallèle. Un vrai bug échoue aux deux essais (et le rapport signale le test « flaky »).
  retries: process.env.CI ? 2 : 1,
  reporter: "list",
  use: { baseURL: E2E_BASE_URL, trace: "on-first-retry" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    // Mobile d'abord : on vérifie aussi sur un écran de téléphone.
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `node --experimental-strip-types --no-warnings scripts/e2e-seed.mts && next dev -H 127.0.0.1 -p ${E2E_PORT}`,
    url: E2E_BASE_URL,
    env: E2E_SERVER_ENV,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});

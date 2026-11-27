import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// Les tests fabriquent un cookie de session chiffré : ils ont besoin du même
// SESSION_SECRET que le serveur de dev, qui le lit dans .env.local.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const baseURL = "http://127.0.0.1:3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: { baseURL, trace: "on-first-retry" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    // Mobile d'abord : on vérifie aussi sur un écran de téléphone.
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "pnpm dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});

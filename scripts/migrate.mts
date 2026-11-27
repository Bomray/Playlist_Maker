// Applique les migrations de db/migrations sur la base DATABASE_URL.
// Usage : `pnpm db:migrate` (local, avec .env.local) ; lancé aussi au build de production.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { applyMigrations } from "../src/lib/db/migrate.ts";
import { createNeonDb } from "../src/lib/db/neon.ts";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const onVercel = Boolean(process.env.VERCEL);
// Sur Vercel, on ne migre qu'en production : un aperçu de PR ne doit pas modifier la vraie base.
if (onVercel && process.env.VERCEL_ENV !== "production") {
  console.log(`Migrations ignorées (environnement Vercel : ${process.env.VERCEL_ENV}).`);
  process.exit(0);
}
const url = process.env.DATABASE_URL;
if (!url) {
  if (onVercel) {
    console.error("DATABASE_URL manquante : crée la base Neon dans Vercel (Storage).");
    process.exit(1);
  }
  console.log("DATABASE_URL absente : migrations ignorées.");
  process.exit(0);
}

const dir = new URL("../db/migrations/", import.meta.url);
const migrations = readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .map((name) => ({ name, sql: readFileSync(new URL(name, dir), "utf8") }));

const applied = await applyMigrations(createNeonDb(url), migrations);
console.log(applied.length ? `Migrations appliquées : ${applied.join(", ")}` : "Base à jour.");

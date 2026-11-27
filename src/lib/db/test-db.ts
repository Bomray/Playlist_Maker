// Base PostgreSQL en mémoire (PGlite) pour les tests : vrai SQL, sans réseau.
// À n'importer que depuis des fichiers *.test.ts (PGlite est une dépendance de développement).
import { readdirSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { applyMigrations } from "./migrate";
import type { Db } from "./types";

export function migrationFiles() {
  const dir = new URL("../../../db/migrations/", import.meta.url);
  return readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .map((name) => ({ name, sql: readFileSync(new URL(name, dir), "utf8") }));
}

/** Nouvelle base vide, migrations appliquées. */
export async function createTestDb(): Promise<Db & { close(): Promise<void> }> {
  const pg = new PGlite();
  const db: Db & { close(): Promise<void> } = {
    query: async (text, params = []) =>
      (await pg.query<Record<string, unknown>>(text, params)).rows,
    close: () => pg.close(),
  };
  await applyMigrations(db, migrationFiles());
  return db;
}

// Base PGlite (PostgreSQL en WebAssembly) pour le développement local et les tests de bout
// en bout, activée par `DATABASE_URL=pglite:<dossier>`. Jamais en production (voir `getDb`).
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { applyMigrations } from "./migrate";
import type { Db } from "./types";

/**
 * Base stockée dans `dataDir`, ouverte au premier appel. Les migrations y sont appliquées
 * automatiquement (pas besoin de `pnpm db:migrate` en local). Import dynamique : PGlite
 * est une dépendance de développement.
 */
export function createPgliteDb(dataDir: string): Db {
  type Pg = { query: <T>(text: string, params?: unknown[]) => Promise<{ rows: T[] }> };
  let ready: Promise<Pg> | undefined;

  const open = async (): Promise<Pg> => {
    const { PGlite } = await import("@electric-sql/pglite");
    const pg = new PGlite(dataDir);
    const dir = path.join(process.cwd(), "db", "migrations");
    const migrations = readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .map((name) => ({ name, sql: readFileSync(path.join(dir, name), "utf8") }));
    await applyMigrations(
      {
        query: async (text, params = []) =>
          (await pg.query<Record<string, unknown>>(text, params)).rows,
      },
      migrations,
    );
    return pg;
  };

  return {
    async query(text, params = []) {
      ready ??= open();
      return (await (await ready).query<Record<string, unknown>>(text, params)).rows;
    },
  };
}

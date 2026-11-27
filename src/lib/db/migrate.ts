// Migrations SQL : fichiers `db/migrations/NNNN_nom.sql` appliqués une fois, dans l'ordre.
// Sans import « @/… » : utilisé par scripts/migrate.ts (Node) et par les tests (PGlite).
import type { Db } from "./types.ts";

export interface Migration {
  name: string;
  sql: string;
}

/**
 * Découpe un fichier en instructions (le pilote HTTP de Neon n'en exécute qu'une par
 * requête). Simple découpage sur « ; » en fin de ligne : pas de fonctions PL/pgSQL ici.
 */
export function splitStatements(sql: string): string[] {
  return sql
    .split(/;\s*$/m)
    .map((s) => s.replace(/^\s*--.*$/gm, "").trim())
    .filter((s) => s.length > 0);
}

/** Applique les migrations pas encore passées ; renvoie leurs noms. */
export async function applyMigrations(db: Db, migrations: readonly Migration[]): Promise<string[]> {
  await db.query(
    "CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
  );
  const done = new Set(
    (await db.query("SELECT name FROM schema_migrations")).map((r) => String(r.name)),
  );
  const applied: string[] = [];
  for (const m of [...migrations].sort((a, b) => a.name.localeCompare(b.name))) {
    if (done.has(m.name)) continue;
    // Les migrations sont écrites pour pouvoir être rejouées (IF NOT EXISTS) si l'une
    // échoue à mi-chemin : le pilote HTTP n'offre pas de transaction sur plusieurs requêtes.
    for (const statement of splitStatements(m.sql)) await db.query(statement);
    await db.query("INSERT INTO schema_migrations (name) VALUES ($1)", [m.name]);
    applied.push(m.name);
  }
  return applied;
}

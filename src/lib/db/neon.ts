// Adaptateur Neon (pilote HTTP, adapté aux fonctions serverless de Vercel).
// Sans import « @/… » : utilisé aussi par scripts/migrate.ts, lancé directement par Node.
import { neon } from "@neondatabase/serverless";
import type { Db } from "./types.ts";

export function createNeonDb(connectionString: string): Db {
  const sql = neon(connectionString);
  return { query: (text, params = []) => sql.query(text, params) };
}

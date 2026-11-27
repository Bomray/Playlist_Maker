/**
 * Interface minimale d'accès à PostgreSQL, commune à Neon (production) et à PGlite
 * (tests). Requêtes paramétrées uniquement (`$1`, `$2`…) : jamais de concaténation.
 */
export interface Db {
  query(text: string, params?: unknown[]): Promise<Record<string, unknown>[]>;
}

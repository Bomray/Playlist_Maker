// Accès à la base côté serveur (une seule instance par processus).
import "server-only";
import { serverEnv } from "@/lib/env";
import { createNeonDb } from "./neon";
import { createPgliteDb } from "./pglite";
import type { Db } from "./types";

let db: Db | undefined;

export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super("Base de données non configurée : DATABASE_URL manquante (voir le README).");
  }
}

export function getDb(): Db {
  if (!db) {
    const url = serverEnv().DATABASE_URL;
    if (!url) throw new DatabaseNotConfiguredError();
    if (url.startsWith("pglite:")) {
      // Base locale en mémoire disque, pour les tests de bout en bout (jamais en production).
      if (process.env.NODE_ENV === "production")
        throw new Error("PGlite n'est pas autorisé en production.");
      db = createPgliteDb(url.slice("pglite:".length));
    } else {
      db = createNeonDb(url);
    }
  }
  return db;
}

export type { Db } from "./types";

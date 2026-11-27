import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";
import { applyMigrations, splitStatements } from "./migrate";
import { migrationFiles } from "./test-db";
import type { Db } from "./types";

function memoryDb(): Db {
  const pg = new PGlite();
  return {
    query: async (text, params = []) =>
      (await pg.query<Record<string, unknown>>(text, params)).rows,
  };
}

describe("splitStatements", () => {
  it("découpe sur « ; » en fin de ligne et retire les commentaires", () => {
    expect(
      splitStatements("-- titre\nCREATE TABLE a (x int);\n\nCREATE INDEX i ON a (x);\n"),
    ).toEqual(["CREATE TABLE a (x int)", "CREATE INDEX i ON a (x)"]);
  });
});

describe("applyMigrations", () => {
  it("applique les migrations du dépôt une seule fois", async () => {
    const db = memoryDb();
    const first = await applyMigrations(db, migrationFiles());
    expect(first).toContain("0001_users.sql");
    expect(await applyMigrations(db, migrationFiles())).toEqual([]);
    const cols = await db.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'users'",
    );
    expect(cols.map((c) => c.column_name)).toEqual(
      expect.arrayContaining(["spotify_user_id", "refresh_token_enc", "collecting"]),
    );
  });

  it("applique dans l'ordre des noms", async () => {
    const db = memoryDb();
    const applied = await applyMigrations(db, [
      { name: "0002_b.sql", sql: "ALTER TABLE t ADD COLUMN b int;" },
      { name: "0001_a.sql", sql: "CREATE TABLE t (a int);" },
    ]);
    expect(applied).toEqual(["0001_a.sql", "0002_b.sql"]);
  });
});

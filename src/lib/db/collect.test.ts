import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  collectStatus,
  collectTargetFor,
  collectTargets,
  recordCollect,
  setCollecting,
} from "./collect";
import { createTestDb } from "./test-db";
import { upsertUser } from "./users";

let db: Awaited<ReturnType<typeof createTestDb>>;
let a: string;
let b: string;
const user = async (sp: string) =>
  (
    await upsertUser(db, {
      spotifyUserId: sp,
      displayName: null,
      tokens: { accessTokenEnc: "a", refreshTokenEnc: "r", expiresAt: new Date(), scope: "" },
    })
  ).id;

beforeEach(async () => {
  db = await createTestDb();
  a = await user("a");
  b = await user("b");
});
afterEach(() => db.close());

describe("collecte en base", () => {
  it("désactivée par défaut, puis activée : seule cible de collecte", async () => {
    expect(await collectStatus(db, a)).toEqual({
      collecting: false,
      lastCollectedAt: null,
      lastError: null,
      apiPlays: 0,
    });
    await setCollecting(db, a, true);
    expect(await collectTargets(db)).toEqual([{ id: a, cursor: null }]);
    expect(await collectTargetFor(db, b)).toEqual({ id: b, cursor: null });
  });

  it("réussite : avance le curseur et efface l'erreur ; échec : garde le curseur", async () => {
    await setCollecting(db, a, true);
    await recordCollect(db, a, { cursor: 1_700_000_000_000 });
    await recordCollect(db, a, { error: "Accès expiré" });
    expect(await collectTargets(db)).toEqual([{ id: a, cursor: 1_700_000_000_000 }]);
    expect((await collectStatus(db, a)).lastError).toBe("Accès expiré");
    // Aucune nouvelle écoute : le curseur ne recule pas.
    await recordCollect(db, a, { cursor: null });
    const s = await collectStatus(db, a);
    expect(s.lastError).toBeNull();
    expect(s.lastCollectedAt).toEqual(expect.any(Number));
    expect((await collectTargets(db))[0]!.cursor).toBe(1_700_000_000_000);
  });

  it("réactiver efface l'ancienne erreur", async () => {
    await setCollecting(db, a, true);
    await recordCollect(db, a, { error: "Accès expiré" });
    await setCollecting(db, a, false);
    await setCollecting(db, a, true);
    expect((await collectStatus(db, a)).lastError).toBeNull();
  });
});

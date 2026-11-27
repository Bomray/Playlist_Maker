import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "./test-db";
import { findUserById, type StoredTokens, updateTokens, upsertUser } from "./users";

let db: Awaited<ReturnType<typeof createTestDb>>;
beforeEach(async () => {
  db = await createTestDb();
});
afterEach(() => db.close());

const tokens = (n: number): StoredTokens => ({
  accessTokenEnc: `acc${n}`,
  refreshTokenEnc: `ref${n}`,
  expiresAt: new Date("2026-12-01T10:00:00Z"),
  scope: "user-read-private",
});

describe("users", () => {
  it("crée puis met à jour le même utilisateur (identifiant Spotify unique)", async () => {
    const a = await upsertUser(db, {
      spotifyUserId: "sp1",
      displayName: "Ryan",
      tokens: tokens(1),
    });
    const b = await upsertUser(db, {
      spotifyUserId: "sp1",
      displayName: "Ryan G",
      tokens: tokens(2),
    });
    expect(b.id).toBe(a.id);
    expect(b).toMatchObject({
      display_name: "Ryan G",
      access_token_enc: "acc2",
      collecting: false,
    });
    expect(b.token_expires_at).toEqual(new Date("2026-12-01T10:00:00Z"));
  });

  it("retrouve par id, et ignore un id mal formé", async () => {
    const u = await upsertUser(db, { spotifyUserId: "sp1", displayName: null, tokens: tokens(1) });
    expect((await findUserById(db, u.id))?.spotify_user_id).toBe("sp1");
    expect(await findUserById(db, "pas-un-uuid")).toBeNull();
    expect(await findUserById(db, "00000000-0000-4000-8000-000000000000")).toBeNull();
  });

  it("met à jour les tokens", async () => {
    const u = await upsertUser(db, { spotifyUserId: "sp1", displayName: null, tokens: tokens(1) });
    await updateTokens(db, u.id, tokens(3));
    expect(await findUserById(db, u.id)).toMatchObject({
      access_token_enc: "acc3",
      refresh_token_enc: "ref3",
    });
  });
});

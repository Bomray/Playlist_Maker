import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { seal } from "@/lib/crypto-box";
import { collectStatus, collectTargets, setCollecting } from "@/lib/db/collect";
import { historySummary } from "@/lib/db/history";
import { createTestDb } from "@/lib/db/test-db";
import { upsertUser } from "@/lib/db/users";
import type { AccountDeps } from "./account";
import { collectAll, collectForUser, toPlays } from "./collector";

const KEY = "cle-de-test-suffisamment-longue-1234567890";
let db: Awaited<ReturnType<typeof createTestDb>>;
let deps: AccountDeps;
let userId: string;

beforeEach(async () => {
  db = await createTestDb();
  deps = {
    db,
    encryptionKey: KEY,
    auth: { clientId: "c", clientSecret: "s", redirectUri: "http://127.0.0.1:3000/callback" },
  };
  const u = await upsertUser(db, {
    spotifyUserId: "sp1",
    displayName: null,
    tokens: {
      accessTokenEnc: seal("acc", KEY),
      refreshTokenEnc: seal("ref", KEY),
      expiresAt: new Date(Date.now() + 3_600_000),
      scope: "",
    },
  });
  userId = u.id;
});
afterEach(async () => {
  vi.unstubAllGlobals();
  await db.close();
});

const item = (playedAt: string, name: string) => ({
  played_at: playedAt,
  track: {
    uri: `spotify:track:${name}`,
    name,
    duration_ms: 200_000,
    type: "track",
    artists: [{ name: "NF" }, { name: "Feat" }],
    album: { name: "Album" },
  },
});

function stubRecent(items: unknown[], status = 200) {
  // Le paramètre `url` sert au typage : les tests lisent `fetchMock.mock.calls[n][0]`.
  const fetchMock = vi.fn<(url: string) => Promise<Response>>(
    async () =>
      new Response(
        JSON.stringify(status === 200 ? { items } : { error: { status, message: "x" } }),
        { status },
      ),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("toPlays", () => {
  it("convertit morceaux et épisodes, ignore les éléments vides", () => {
    const plays = toPlays([
      item("2026-11-27T10:00:00Z", "Lie"),
      {
        played_at: "2026-11-27T11:00:00Z",
        track: {
          uri: "spotify:episode:e1",
          name: "Ép. 1",
          duration_ms: 1_800_000,
          type: "episode",
          show: { name: "Podcast" },
        },
      },
      { played_at: "2026-11-27T12:00:00Z", track: null },
    ]);
    expect(plays).toEqual([
      {
        endedAt: Date.parse("2026-11-27T10:00:00Z"),
        msPlayed: 200_000,
        kind: "music",
        title: "Lie",
        artist: "NF",
        album: "Album",
        uri: "spotify:track:Lie",
        skipped: null,
        offlineTs: 0,
      },
      {
        endedAt: Date.parse("2026-11-27T11:00:00Z"),
        msPlayed: 1_800_000,
        kind: "podcast",
        title: "Ép. 1",
        artist: "Podcast",
        album: null,
        uri: "spotify:episode:e1",
        skipped: null,
        offlineTs: 0,
      },
    ]);
  });
});

describe("collectForUser", () => {
  it("enregistre les nouvelles écoutes, avance le curseur, puis ne demande que la suite", async () => {
    const fetchMock = stubRecent([
      item("2026-11-27T10:00:00Z", "A"),
      item("2026-11-27T11:00:00Z", "B"),
    ]);
    expect(await collectForUser(deps, { id: userId, cursor: null })).toMatchObject({
      fetched: 2,
      inserted: 2,
      error: null,
    });
    expect(new URL(fetchMock.mock.calls[0]![0]).searchParams.get("after")).toBeNull();

    await setCollecting(db, userId, true);
    const [target] = await collectTargets(db);
    expect(target!.cursor).toBe(Date.parse("2026-11-27T11:00:00Z"));
    await collectForUser(deps, target!);
    expect(new URL(fetchMock.mock.calls[1]![0]).searchParams.get("after")).toBe(
      String(Date.parse("2026-11-27T11:00:00Z")),
    );
    // Même réponse renvoyée : rien de nouveau (doublons ignorés).
    expect((await historySummary(db, userId)).plays).toBe(2);
    expect((await collectStatus(db, userId)).apiPlays).toBe(2);
  });

  it("accès révoqué : erreur enregistrée et renvoyée, sans lever", async () => {
    await db.query("UPDATE users SET token_expires_at = now() - interval '1 hour' WHERE id = $1", [
      userId,
    ]);
    stubRecent([], 400); // le rafraîchissement du token est refusé
    const result = await collectForUser(deps, { id: userId, cursor: null });
    expect(result.error).toMatch(/reconnecte-toi/);
    expect((await collectStatus(db, userId)).lastError).toMatch(/reconnecte-toi/);
  });
});

describe("collectAll", () => {
  it("ne collecte que pour les utilisateurs qui ont donné leur accord", async () => {
    const fetchMock = stubRecent([item("2026-11-27T10:00:00Z", "A")]);
    expect(await collectAll(deps)).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
    await setCollecting(db, userId, true);
    expect(await collectAll(deps)).toEqual([{ userId, fetched: 1, inserted: 1, error: null }]);
  });
});

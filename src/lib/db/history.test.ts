import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Play } from "@/core/stats";
import {
  cursorAfter,
  deleteHistory,
  historySummary,
  importPlays,
  type PlayRow,
  type PlaysCursor,
  playsPage,
  trackKey,
  userTracks,
} from "./history";
import { createTestDb } from "./test-db";
import { upsertUser } from "./users";

let db: Awaited<ReturnType<typeof createTestDb>>;
let userId: string;
let otherId: string;

async function user(spotifyUserId: string) {
  const u = await upsertUser(db, {
    spotifyUserId,
    displayName: null,
    tokens: { accessTokenEnc: "a", refreshTokenEnc: "r", expiresAt: new Date(), scope: "" },
  });
  return u.id;
}

beforeEach(async () => {
  db = await createTestDb();
  userId = await user("u1");
  otherId = await user("u2");
});
afterEach(() => db.close());

function play(iso: string, o: Partial<Play> = {}): Play {
  return {
    endedAt: Date.parse(iso),
    msPlayed: 180_000,
    kind: "music",
    title: "Lie",
    artist: "NF",
    album: "Perception",
    uri: "spotify:track:lie",
    skipped: false,
    offlineTs: 0,
    ...o,
  };
}

describe("trackKey", () => {
  it("URI si connue, sinon type + artiste + titre", () => {
    expect(trackKey(play("2024-01-01T00:00:00Z"))).toBe("spotify:track:lie");
    expect(trackKey(play("2024-01-01T00:00:00Z", { uri: null }))).toBe("music:NF\u001fLie");
  });
});

describe("importPlays", () => {
  it("ajoute les écoutes, partage les morceaux et ignore les doublons (réimport)", async () => {
    const batch = [
      play("2024-01-01T10:00:00Z"),
      play("2024-01-02T10:00:00Z"),
      play("2024-01-02T11:00:00Z", { uri: "spotify:track:b", title: "B" }),
      play("2024-01-02T11:00:00Z", { uri: "spotify:track:b", title: "B" }), // doublon dans le lot
    ];
    expect(await importPlays(db, userId, batch, "import")).toBe(3);
    expect(await importPlays(db, userId, batch, "import")).toBe(0);
    // Un autre utilisateur écoute le même morceau : même ligne `tracks`.
    expect(await importPlays(db, otherId, [play("2024-01-01T10:00:00Z")], "import")).toBe(1);
    const tracks = await db.query("SELECT count(*)::int AS n FROM tracks");
    expect(tracks[0]!.n).toBe(2);
  });

  it("morceaux sans URI et podcasts", async () => {
    await importPlays(
      db,
      userId,
      [
        play("2024-01-01T10:00:00Z", { uri: null, album: null }),
        play("2024-01-01T11:00:00Z", {
          uri: null,
          kind: "podcast",
          title: "Ép. 1",
          artist: "Podcast",
          album: null,
        }),
      ],
      "import",
    );
    const tracks = await userTracks(db, userId);
    expect(tracks.map((t) => [t[1], t[5]]).sort()).toEqual([
      ["Lie", "music"],
      ["Ép. 1", "podcast"],
    ]);
  });

  it("écoutes hors ligne au même instant gardées, vrai doublon écarté", async () => {
    // Cas réel : écoutes hors ligne synchronisées ensemble, même date de fin et même morceau.
    const a = play("2024-05-01T08:00:00Z", { msPlayed: 200_000, offlineTs: 1714550000 });
    const b = play("2024-05-01T08:00:00Z", { msPlayed: 150_000, offlineTs: 1714550300 });
    expect(await importPlays(db, userId, [a, b, { ...a }], "import")).toBe(2);
  });

  it("lot vide : aucune requête", async () => {
    expect(await importPlays(db, userId, [], "import")).toBe(0);
  });
});

describe("lecture et suppression", () => {
  beforeEach(async () => {
    await importPlays(
      db,
      userId,
      [
        play("2024-01-01T10:00:00Z"),
        // Deux écoutes à la même seconde (morceaux différents) : la pagination ne doit en perdre aucune.
        play("2024-01-02T10:00:00Z", { uri: "spotify:track:b", title: "B" }),
        play("2024-01-02T10:00:00Z", { uri: "spotify:track:c", title: "C" }),
        play("2024-01-03T10:00:00Z", { msPlayed: 5_000, skipped: true }),
      ],
      "import",
    );
    await importPlays(db, otherId, [play("2025-01-01T10:00:00Z")], "import");
  });

  it("résumé : nombre et période, propre à l'utilisateur", async () => {
    expect(await historySummary(db, userId)).toEqual({
      plays: 4,
      first: Date.parse("2024-01-01T10:00:00Z"),
      last: Date.parse("2024-01-03T10:00:00Z"),
    });
  });

  it("pagination par curseur (clé complète) sans perte ni doublon", async () => {
    const all: PlayRow[] = [];
    let after: PlaysCursor | null = null;
    for (;;) {
      const page = await playsPage(db, userId, after, 1);
      if (page.length === 0) break;
      all.push(...page);
      after = cursorAfter(page.at(-1)!);
    }
    expect(all).toHaveLength(4);
    expect(all.map((r) => r[1])).toEqual([...all.map((r) => r[1])].sort((a, b) => a - b));
    expect(all.at(-1)).toEqual([
      expect.any(Number),
      Date.parse("2024-01-03T10:00:00Z"),
      5_000,
      true,
      0,
    ]);
  });

  it("supprime l'historique d'un seul utilisateur", async () => {
    expect(await deleteHistory(db, userId)).toBe(4);
    expect((await historySummary(db, userId)).plays).toBe(0);
    expect((await historySummary(db, otherId)).plays).toBe(1);
  });
});

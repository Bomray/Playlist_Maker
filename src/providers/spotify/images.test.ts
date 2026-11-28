import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Play } from "@/core/stats";
import { importPlays } from "@/lib/db/history";
import { findImages } from "@/lib/db/images";
import { createTestDb } from "@/lib/db/test-db";
import { upsertUser } from "@/lib/db/users";
import type { Clock } from "@/lib/rate-limit";
import { fillImages, matchArtist, pickImage } from "./images";

let db: Awaited<ReturnType<typeof createTestDb>>;

/** Horloge factice : le temps n'avance que quand le code attend. */
function fakeClock(): Clock {
  let t = 0;
  return { now: () => t, sleep: async (ms) => void (t += ms) };
}

const play = (n: number, id: string, artist = "NF"): Play => ({
  endedAt: Date.UTC(2025, 0, 1) + n * 60_000,
  msPlayed: 200_000,
  kind: "music",
  title: id,
  artist,
  album: `Album ${id}`,
  uri: `spotify:track:${id}`,
  skipped: null,
  offlineTs: 0,
});

beforeEach(async () => {
  db = await createTestDb();
  const { id } = await upsertUser(db, {
    spotifyUserId: "u",
    displayName: null,
    tokens: { accessTokenEnc: "a", refreshTokenEnc: "r", expiresAt: new Date(), scope: "" },
  });
  await importPlays(db, id, [play(1, "lie"), play(2, "gone")], "import");
});
afterEach(async () => {
  vi.unstubAllGlobals();
  await db.close();
});

const img = (w: number) => ({ url: `https://i.scdn.co/image/${w}`, width: w, height: w });

function stubSpotify(routes: Record<string, { status: number; body?: unknown }>) {
  const fetchMock = vi.fn<(url: string) => Promise<Response>>(async (url) => {
    const path = new URL(url).pathname.replace("/v1", "");
    const r = routes[path] ?? { status: 404 };
    return new Response(JSON.stringify(r.body ?? { error: { status: r.status } }), {
      status: r.status,
      headers: r.status === 429 ? { "retry-after": "3600" } : {},
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("choix des images", () => {
  it("la plus petite assez grande, sinon la plus grande", () => {
    expect(pickImage([img(640), img(64), img(300)], 300)).toBe("https://i.scdn.co/image/300");
    expect(pickImage([img(64), img(200)], 600)).toBe("https://i.scdn.co/image/200");
    expect(pickImage([], 300)).toBeNull();
  });

  it("l'artiste du même nom, sinon le premier", () => {
    const artists = [
      { id: "a", name: "Eminem" },
      { id: "b", name: "NF" },
    ];
    expect(matchArtist(artists, "nf")).toBe("b");
    expect(matchArtist(artists, "Autre")).toBe("a");
  });
});

describe("remplissage des images", () => {
  it("pochettes puis photos ; morceau disparu noté sans image", async () => {
    const fetchMock = stubSpotify({
      "/tracks/lie": {
        status: 200,
        body: { artists: [{ id: "nf", name: "NF" }], album: { images: [img(640), img(300)] } },
      },
      "/artists/nf": { status: 200, body: { images: [img(1000), img(640), img(200)] } },
    });
    const result = await fillImages(
      { db, getToken: async () => "tok", clock: fakeClock() },
      60_000,
    );
    expect(result).toEqual({ tracks: 2, artists: 1, rateLimited: false, failed: false });
    expect(fetchMock.mock.calls[0]![0]).toContain("/v1/tracks/");

    const images = await findImages(db, {
      tracks: [{ key: "spotify:track:lie", artist: "NF", title: "lie" }],
      artists: ["NF"],
      albums: [{ key: "NF\u0000Album lie", artist: "NF", album: "Album lie" }],
    });
    expect(images.tracks["spotify:track:lie"]).toBe("https://i.scdn.co/image/300");
    expect(images.artists.NF).toBe("https://i.scdn.co/image/640");
    expect(images.albums["NF\u0000Album lie"]).toBe("https://i.scdn.co/image/300");

    // Rien à refaire : aucun nouvel appel.
    fetchMock.mockClear();
    await fillImages({ db, getToken: async () => "tok", clock: fakeClock() }, 60_000);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("s'arrête sur un 429 sans rien marquer", async () => {
    stubSpotify({ "/tracks/lie": { status: 429 }, "/tracks/gone": { status: 429 } });
    const result = await fillImages(
      { db, getToken: async () => "tok", clock: fakeClock() },
      60_000,
    );
    expect(result).toMatchObject({ tracks: 0, rateLimited: true });
  });

  it("respecte le budget de temps", async () => {
    stubSpotify({});
    const result = await fillImages({ db, getToken: async () => "tok", clock: fakeClock() }, 0);
    expect(result.tracks).toBe(0);
  });
});

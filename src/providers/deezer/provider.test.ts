import { afterEach, describe, expect, it, vi } from "vitest";
import { createFakeClock } from "@/lib/fake-clock";
import { createRateLimiter } from "@/lib/rate-limit";
import { createDeezerClient } from "./client";
import { createDeezerProvider } from "./provider";

function deezerTrack(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    title: `Titre ${id}`,
    duration: 200 + id,
    isrc: `FRXXX${String(id).padStart(7, "0")}`,
    readable: true,
    artist: { name: `Artiste ${id}` },
    album: { title: `Album ${id}` },
    ...overrides,
  };
}

/** Simule l'API : répond selon l'URL demandée. */
function stubApi(routes: Record<string, unknown>) {
  const fetchMock = vi.fn((url: string) => {
    if (!(url in routes)) return Promise.resolve(new Response("not found", { status: 404 }));
    return Promise.resolve(new Response(JSON.stringify(routes[url])));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function provider() {
  const clock = createFakeClock();
  const limiter = createRateLimiter({ limit: 1000, windowMs: 5000, clock });
  return createDeezerProvider(createDeezerClient({ limiter, clock }));
}

const API = "https://api.deezer.com";
const ref = { provider: "deezer", id: "42" } as const;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("provider Deezer", () => {
  it("lit la playlist et toutes ses pages", async () => {
    const fetchMock = stubApi({
      [`${API}/playlist/42`]: { id: 42, title: "Ma playlist", description: "Desc", nb_tracks: 3 },
      [`${API}/playlist/42/tracks?limit=100`]: {
        data: [deezerTrack(1), deezerTrack(2)],
        total: 3,
        next: `${API}/playlist/42/tracks?limit=100&index=100`,
      },
      [`${API}/playlist/42/tracks?limit=100&index=100`]: { data: [deezerTrack(3)], total: 3 },
    });

    const playlist = await provider().getPlaylist(ref);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(playlist.name).toBe("Ma playlist");
    expect(playlist.description).toBe("Desc");
    expect(playlist.tracks.map((t) => t.providerTrackId)).toEqual(["1", "2", "3"]);
    expect(playlist.tracks[0]).toEqual({
      title: "Titre 1",
      artists: ["Artiste 1"],
      album: "Album 1",
      durationMs: 201_000,
      isrc: "FRXXX0000001",
      provider: "deezer",
      providerTrackId: "1",
    });
  });

  it("garde les titres non lisibles et gère les champs absents", async () => {
    stubApi({
      [`${API}/playlist/42`]: { id: 42, title: "P", description: "", nb_tracks: 1 },
      [`${API}/playlist/42/tracks?limit=100`]: {
        data: [deezerTrack(9, { readable: false, isrc: "", album: null })],
      },
    });
    const playlist = await provider().getPlaylist(ref);
    expect(playlist.description).toBeNull();
    expect(playlist.tracks[0]).toMatchObject({ isrc: null, album: null, providerTrackId: "9" });
  });

  it("playlist inconnue → not_found", async () => {
    stubApi({
      [`${API}/playlist/42`]: { error: { type: "DataException", message: "no data", code: 800 } },
    });
    await expect(provider().getPlaylist(ref)).rejects.toMatchObject({
      kind: "not_found",
      provider: "deezer",
    });
  });

  it("searchTrack et createPlaylist sont refusés (lecture seule)", async () => {
    const p = provider();
    await expect(
      p.createPlaylist({ name: "x", description: null, trackIds: [] }),
    ).rejects.toMatchObject({ kind: "unsupported" });
    await expect(
      p.searchTrack({
        title: "t",
        artists: [],
        album: null,
        durationMs: null,
        isrc: null,
        provider: "spotify",
        providerTrackId: "x",
      }),
    ).rejects.toMatchObject({ kind: "unsupported" });
  });

  it("expose la reconnaissance des liens", () => {
    expect(provider().parsePlaylistUrl("https://www.deezer.com/fr/playlist/42")).toEqual(ref);
  });
});

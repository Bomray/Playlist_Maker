import { afterEach, describe, expect, it, vi } from "vitest";
import { createYouTubeClient } from "./client";
import { createYouTubeMusicProvider } from "./provider";

const ref = { provider: "youtube-music", id: "PL42" } as const;

function item(videoId: string, title: string, channel?: string) {
  return { snippet: { title, videoOwnerChannelTitle: channel, resourceId: { videoId } } };
}

/** Simule l'API : la clé de `routes` est le chemin + les paramètres triés. */
function stubApi(routes: Record<string, { status?: number; body: unknown }>) {
  const fetchMock = vi.fn((input: string, init: RequestInit) => {
    const url = new URL(input);
    const params = [...url.searchParams.entries()]
      .sort()
      .map(([k, v]) => `${k}=${v}`)
      .join("&");
    const key = `${url.pathname.replace("/youtube/v3", "")}?${params}`;
    const route = routes[key];
    void init;
    if (!route) return Promise.resolve(new Response(`route absente : ${key}`, { status: 500 }));
    return Promise.resolve(
      new Response(JSON.stringify(route.body), { status: route.status ?? 200 }),
    );
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

// Pas de valeur par défaut : `provider(undefined)` doit vraiment tester l'absence de clé.
const provider = (...args: [] | [string | undefined]) =>
  createYouTubeMusicProvider(createYouTubeClient(args.length ? args[0] : "cle-test"));

function googleError(code: number, reason: string) {
  return { status: code, body: { error: { code, message: reason, errors: [{ reason }] } } };
}

afterEach(() => vi.unstubAllGlobals());

describe("provider YouTube Music", () => {
  it("lit nom, titres paginés et durées ; ignore et compte les vidéos indisponibles", async () => {
    const fetchMock = stubApi({
      "/playlists?id=PL42&part=snippet": {
        body: { items: [{ id: "PL42", snippet: { title: "Test APP", description: "" } }] },
      },
      "/playlistItems?maxResults=50&part=snippet&playlistId=PL42": {
        body: {
          items: [item("v1", "Lie", "NF - Topic"), item("v2", "Deleted video")],
          nextPageToken: "P2",
        },
      },
      "/playlistItems?maxResults=50&pageToken=P2&part=snippet&playlistId=PL42": {
        body: {
          items: [
            item("v3", "Orelsan - La pluie (Clip Officiel)", "Orelsan"),
            item("v4", "Private video"),
          ],
        },
      },
      "/videos?id=v1,v3&part=contentDetails": {
        body: {
          items: [
            { id: "v1", contentDetails: { duration: "PT3M30S" } },
            { id: "v3", contentDetails: { duration: "PT4M" } },
          ],
        },
      },
    });

    const playlist = await provider().getPlaylist(ref);

    expect(playlist).toMatchObject({ name: "Test APP", description: null, unavailableCount: 2 });
    expect(playlist.tracks).toEqual([
      {
        title: "Lie",
        artists: ["NF"],
        album: null,
        durationMs: 210_000,
        isrc: null,
        provider: "youtube-music",
        providerTrackId: "v1",
      },
      {
        title: "La pluie",
        artists: ["Orelsan"],
        album: null,
        durationMs: 240_000,
        isrc: null,
        provider: "youtube-music",
        providerTrackId: "v3",
      },
    ]);
    // La clé part dans l'en-tête, jamais dans l'URL.
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).not.toContain("cle-test");
    expect((init.headers as Record<string, string>)["X-goog-api-key"]).toBe("cle-test");
  });

  it("playlist privée ou inexistante (liste vide) : not_found", async () => {
    stubApi({ "/playlists?id=PL42&part=snippet": { body: { items: [] } } });
    await expect(provider().getPlaylist(ref)).rejects.toMatchObject({
      kind: "not_found",
      provider: "youtube-music",
    });
  });

  it("refuse les Mix et les titres likés sans appeler l'API", async () => {
    const fetchMock = stubApi({});
    await expect(
      provider().getPlaylist({ provider: "youtube-music", id: "RDCLAK5uy_x" }),
    ).rejects.toMatchObject({ kind: "unsupported" });
    await expect(
      provider().getPlaylist({ provider: "youtube-music", id: "LM" }),
    ).rejects.toMatchObject({ kind: "unsupported" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sans clé : « non configuré », sans appel réseau", async () => {
    const fetchMock = stubApi({});
    await expect(provider(undefined).getPlaylist(ref)).rejects.toMatchObject({
      kind: "unsupported",
      message: expect.stringContaining("YOUTUBE_API_KEY"),
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    [googleError(403, "quotaExceeded"), "quota"],
    [googleError(404, "playlistNotFound"), "not_found"],
    [googleError(403, "playlistItemsNotAccessible"), "not_accessible"],
    [googleError(400, "badRequest"), "forbidden"],
    [googleError(429, "rateLimitExceeded"), "rate_limited"],
  ])("traduit l'erreur Google %#", async (route, kind) => {
    stubApi({ "/playlists?id=PL42&part=snippet": route });
    await expect(provider().getPlaylist(ref)).rejects.toMatchObject({
      kind,
      provider: "youtube-music",
    });
  });

  it("lecture seule : recherche et création refusées", async () => {
    await expect(provider().searchTrack({} as never)).rejects.toMatchObject({
      kind: "unsupported",
    });
    await expect(
      provider().createPlaylist({ name: "x", description: null, trackIds: [] }),
    ).rejects.toMatchObject({
      kind: "unsupported",
    });
  });
});

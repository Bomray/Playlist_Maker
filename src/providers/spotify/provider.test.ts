import { afterEach, describe, expect, it, vi } from "vitest";
import type { Track } from "@/core/models";
import { createFakeClock } from "@/lib/fake-clock";
import { buildSearchQueries, createSpotifyProvider } from "./provider";

const API = "https://api.spotify.com/v1";
const PL_ID = "2V1Ti24yYnpwKT57BvAKK7";

function spotifyTrack(n: number, overrides: Record<string, unknown> = {}) {
  return {
    id: `id${n}`,
    uri: `spotify:track:id${n}`,
    name: `Titre ${n}`,
    duration_ms: 180_000 + n,
    type: "track",
    is_local: false,
    artists: [{ name: `Artiste ${n}` }, { name: "Feat" }],
    album: { name: `Album ${n}` },
    external_ids: { isrc: `USXXX${n}` },
    ...overrides,
  };
}

const deezerTrack: Track = {
  title: 'Cut To The "Feeling"',
  artists: ["Carly Rae Jepsen"],
  album: null,
  durationMs: 207_000,
  isrc: "USUM71703861",
  provider: "deezer",
  providerTrackId: "1",
};

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers });
}

function setup(...responses: Response[]) {
  const fetchMock = vi.fn();
  for (const r of responses) fetchMock.mockResolvedValueOnce(r);
  vi.stubGlobal("fetch", fetchMock);
  const clock = createFakeClock();
  const provider = createSpotifyProvider({ getAccessToken: async () => "tok", clock });
  const call = (i: number) => {
    const [url, init] = fetchMock.mock.calls[i] as [string, RequestInit];
    return { url: new URL(url), init, body: init.body ? JSON.parse(init.body as string) : null };
  };
  return { fetchMock, provider, clock, call };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("buildSearchQueries", () => {
  it("ISRC, puis titre + artiste filtrés, puis texte libre ; sans guillemets", () => {
    expect(buildSearchQueries(deezerTrack)).toEqual([
      "isrc:USUM71703861",
      'track:"Cut To The Feeling" artist:"Carly Rae Jepsen"',
      "Cut To The Feeling Carly Rae Jepsen",
    ]);
  });

  it("sans ISRC ni artiste", () => {
    expect(buildSearchQueries({ ...deezerTrack, isrc: null, artists: [] })).toEqual([
      "Cut To The Feeling",
    ]);
  });
});

describe("searchTrack", () => {
  it("s'arrête à la recherche par ISRC si elle trouve, et convertit les champs", async () => {
    const { provider, fetchMock, call } = setup(json({ tracks: { items: [spotifyTrack(1)] } }));
    const results = await provider.searchTrack(deezerTrack);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const { url, init } = call(0);
    expect(url.pathname).toBe("/v1/search");
    expect(url.searchParams.get("q")).toBe("isrc:USUM71703861");
    expect(url.searchParams.get("limit")).toBe("10");
    expect(url.searchParams.get("market")).toBe("from_token");
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer tok");
    expect(results).toEqual([
      {
        title: "Titre 1",
        artists: ["Artiste 1", "Feat"],
        album: "Album 1",
        durationMs: 180_001,
        isrc: "USXXX1",
        provider: "spotify",
        providerTrackId: "spotify:track:id1",
      },
    ]);
  });

  it("passe à la recherche suivante quand la précédente ne trouve rien", async () => {
    const empty = () => json({ tracks: { items: [] } });
    const { provider, fetchMock, call } = setup(
      empty(),
      empty(),
      json({ tracks: { items: [spotifyTrack(2)] } }),
    );
    const results = await provider.searchTrack(deezerTrack);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(call(2).url.searchParams.get("q")).toBe("Cut To The Feeling Carly Rae Jepsen");
    expect(results).toHaveLength(1);
  });

  it("ignore les fichiers locaux et les épisodes ; renvoie [] si rien n'est trouvé", async () => {
    const items = [spotifyTrack(3, { is_local: true }), spotifyTrack(4, { type: "episode" })];
    const { provider } = setup(
      json({ tracks: { items } }),
      json({ tracks: { items } }),
      json({ tracks: { items } }),
    );
    await expect(provider.searchTrack(deezerTrack)).resolves.toEqual([]);
  });

  it("réessaie après un 429 en respectant Retry-After", async () => {
    const { provider, clock } = setup(
      json({ error: { status: 429 } }, 429, { "Retry-After": "3" }),
      json({ tracks: { items: [spotifyTrack(5)] } }),
    );
    await expect(provider.searchTrack(deezerTrack)).resolves.toHaveLength(1);
    expect(clock.sleeps).toEqual([3000]);
  });

  it("n'attend pas un Retry-After trop long : l'erreur remonte", async () => {
    const { provider } = setup(json({}, 429, { "Retry-After": "3600" }));
    await expect(provider.searchTrack(deezerTrack)).rejects.toMatchObject({ kind: "rate_limited" });
  });
});

describe("createPlaylist", () => {
  it("crée une playlist privée puis ajoute les titres par paquets de 100", async () => {
    const trackIds = Array.from({ length: 250 }, (_, i) => `spotify:track:t${i}`);
    const snap = () => json({ snapshot_id: "s" }, 201);
    const { provider, fetchMock, call } = setup(
      json(
        {
          id: "new",
          name: "Ma playlist",
          external_urls: { spotify: "https://open.spotify.com/playlist/new" },
        },
        201,
      ),
      snap(),
      snap(),
      snap(),
    );

    const created = await provider.createPlaylist({
      name: "Ma playlist",
      description: "D",
      trackIds,
    });

    expect(created).toEqual({ id: "new", url: "https://open.spotify.com/playlist/new" });
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(call(0).url.pathname).toBe("/v1/me/playlists");
    expect(call(0).body).toEqual({ name: "Ma playlist", public: false, description: "D" });
    expect(call(1).url.pathname).toBe("/v1/playlists/new/items");
    expect(call(1).body.uris).toHaveLength(100);
    expect(call(3).body.uris).toEqual(trackIds.slice(200));
  });

  it("n'envoie pas de description vide", async () => {
    const { provider, call } = setup(
      json({ id: "p", name: "P", external_urls: { spotify: "u" } }, 201),
    );
    await provider.createPlaylist({ name: "P", description: null, trackIds: [] });
    expect(call(0).body).toEqual({ name: "P", public: false });
  });
});

describe("getPlaylist", () => {
  const ref = { provider: "spotify", id: PL_ID } as const;
  const meta = () =>
    json({ id: PL_ID, name: "L²", description: "", external_urls: { spotify: "u" } });

  it("lit toutes les pages, accepte `track` et `item`, ignore les fichiers locaux", async () => {
    const { provider, fetchMock } = setup(
      meta(),
      json({
        items: [{ track: spotifyTrack(1) }, { item: spotifyTrack(2) }, { track: null }],
        next: `${API}/playlists/${PL_ID}/items?offset=50&limit=50`,
      }),
      json({ items: [{ track: spotifyTrack(3, { is_local: true, id: null }) }], next: null }),
    );
    const playlist = await provider.getPlaylist(ref);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(playlist.name).toBe("L²");
    expect(playlist.description).toBeNull();
    expect(playlist.tracks.map((t) => t.providerTrackId)).toEqual([
      "spotify:track:id1",
      "spotify:track:id2",
    ]);
  });

  it("playlist d'un autre utilisateur (403 sur les titres) → not_accessible", async () => {
    const body = '{"error":{"status":403,"message":"Forbidden"}}';
    const { provider } = setup(meta(), new Response(body, { status: 403 }));
    await expect(provider.getPlaylist(ref)).rejects.toMatchObject({
      kind: "not_accessible",
      status: 403,
      detail: body,
    });
  });

  it("refuse de suivre un lien `next` hors de l'API Spotify", async () => {
    const { provider } = setup(meta(), json({ items: [], next: "https://evil.example/x" }));
    await expect(provider.getPlaylist(ref)).rejects.toMatchObject({ kind: "invalid_response" });
  });
});

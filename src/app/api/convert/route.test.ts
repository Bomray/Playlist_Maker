import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProviderError } from "@/core/errors";
import type { Playlist, Track } from "@/core/models";
import { type ConversionEvent, readConversionEvents } from "@/lib/conversion-stream";
import type { MusicProvider } from "@/providers/types";

const getSpotifyAccessToken = vi.fn<(minValidityMs?: number) => Promise<string>>();
vi.mock("@/providers/spotify/session", () => ({ getSpotifyAccessToken }));

const providers: { sources: MusicProvider[]; destination: MusicProvider } = {
  sources: [],
  destination: undefined as unknown as MusicProvider,
};
const createConversionProviders = vi.fn((getToken: () => Promise<string>) => {
  void getToken;
  return providers;
});
vi.mock("@/providers/registry", () => ({ createConversionProviders }));

const { POST } = await import("./route");

function track(provider: Track["provider"], id: string, isrc: string): Track {
  return {
    title: `T${id}`,
    artists: ["A"],
    album: null,
    durationMs: 1000,
    isrc,
    provider,
    providerTrackId: id,
  };
}

const playlist: Playlist = {
  ref: { provider: "deezer", id: "42" },
  name: "French rap",
  description: null,
  tracks: [track("deezer", "1", "ISRC1"), track("deezer", "2", "ISRC2")],
};

function fake(id: MusicProvider["id"], overrides: Partial<MusicProvider> = {}): MusicProvider {
  return {
    id,
    parsePlaylistUrl: (url) => (url.includes(id) ? { provider: id, id: "42" } : null),
    getPlaylist: vi.fn(async () => playlist),
    searchTrack: vi.fn(async (t: Track) =>
      t.isrc === "ISRC1" ? [track("spotify", "s1", "ISRC1")] : [],
    ),
    createPlaylist: vi.fn(),
    ...overrides,
  };
}

function post(body: unknown, contentType = "application/json") {
  return POST(
    new Request("http://127.0.0.1:3000/api/convert", {
      method: "POST",
      headers: { "content-type": contentType },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

async function events(res: Response) {
  const out: ConversionEvent[] = [];
  for await (const e of readConversionEvents(res.body!)) out.push(e);
  return out;
}

beforeEach(() => {
  getSpotifyAccessToken.mockResolvedValue("tok");
  providers.destination = fake("spotify");
  providers.sources = [fake("deezer"), providers.destination];
});

afterEach(() => vi.clearAllMocks());

describe("POST /api/convert", () => {
  it("diffuse playlist, progression puis rapport", async () => {
    const res = await post({ url: "https://deezer.test/playlist/42" });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/x-ndjson");

    const evs = await events(res);
    expect(evs.map((e) => e.type)).toEqual([
      "playlist",
      "progress",
      "progress",
      "progress",
      "done",
    ]);
    expect(evs[0]).toEqual({ type: "playlist", name: "French rap", source: "deezer", total: 2 });
    const done = evs.at(-1);
    if (done?.type !== "done") throw new Error("pas de rapport");
    expect(done.report.summary).toMatchObject({ total: 2, found: 1, notFound: 1 });
  });

  it("rafraîchit le token avant le flux, avec une marge pour toute la conversion", async () => {
    await events(await post({ url: "https://deezer.test/playlist/42" }));
    expect(getSpotifyAccessToken).toHaveBeenCalledTimes(1);
    expect(getSpotifyAccessToken.mock.calls[0]![0]).toBeGreaterThanOrEqual(30 * 60_000);
    // Les providers reçoivent le token déjà obtenu, sans nouvelle lecture du cookie.
    const getToken = createConversionProviders.mock.calls[0]![0];
    expect(await getToken()).toBe("tok");
  });

  it("pas connecté à Spotify : 401 JSON, sans flux", async () => {
    getSpotifyAccessToken.mockRejectedValue(
      new ProviderError({
        kind: "unauthorized",
        provider: "spotify",
        message: "Pas connecté à Spotify",
      }),
    );
    const res = await post({ url: "https://deezer.test/playlist/42" });
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({
      error: { kind: "unauthorized", message: "Pas connecté à Spotify" },
    });
  });

  it("refuse un corps qui n'est pas du JSON valide", async () => {
    expect((await post("url=x", "application/x-www-form-urlencoded")).status).toBe(415);
    expect((await post({ link: "x" })).status).toBe(400);
    expect((await post("{pas du json")).status).toBe(400);
    expect(getSpotifyAccessToken).not.toHaveBeenCalled();
  });

  it("lien non reconnu : événement d'erreur typé", async () => {
    const evs = await events(await post({ url: "https://exemple.fr" }));
    expect(evs).toEqual([
      { type: "error", error: expect.objectContaining({ kind: "unsupported" }) },
    ]);
  });

  it("source = destination : erreur « unsupported »", async () => {
    const evs = await events(await post({ url: "https://spotify.test/playlist/42" }));
    expect(evs[0]).toMatchObject({
      type: "error",
      error: { kind: "unsupported", provider: "spotify" },
    });
  });

  it("erreur de lecture de la source transmise telle quelle", async () => {
    providers.sources[0] = fake("deezer", {
      getPlaylist: async () => {
        throw new ProviderError({
          kind: "not_found",
          provider: "deezer",
          message: "Playlist introuvable",
        });
      },
    });
    const evs = await events(await post({ url: "https://deezer.test/playlist/42" }));
    expect(evs).toEqual([
      {
        type: "error",
        error: {
          kind: "not_found",
          provider: "deezer",
          message: "Playlist introuvable",
          retryAfterSeconds: null,
        },
      },
    ]);
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { ProviderError } from "@/core/errors";
import type { MusicProvider } from "@/providers/types";

vi.mock("@/providers/spotify/session", () => ({ getSpotifyAccessToken: async () => "tok" }));
const destination = {
  id: "spotify",
  searchTrack: vi.fn(),
  createPlaylist: vi.fn(),
} as unknown as MusicProvider & {
  searchTrack: ReturnType<typeof vi.fn>;
  createPlaylist: ReturnType<typeof vi.fn>;
};
vi.mock("@/providers/registry", () => ({
  createConversionProviders: () => ({ sources: [], destination }),
}));

const { createConvertedPlaylist, searchDestinationTrack } = await import("./conversion");

const URI = "spotify:track:11dFghVXANMlKmJXsNCbNl";

afterEach(() => vi.clearAllMocks());

describe("searchDestinationTrack", () => {
  it("cherche par texte (sans ISRC) et renvoie les candidats", async () => {
    destination.searchTrack.mockResolvedValue([]);
    const res = await searchDestinationTrack({
      title: " Hide ",
      artist: "Juice WRLD",
      durationMs: null,
    });
    expect(res).toEqual({ ok: true, data: [] });
    expect(destination.searchTrack).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Hide", artists: ["Juice WRLD"], isrc: null }),
    );
  });

  it("titre vide : erreur typée, sans appel à Spotify", async () => {
    const res = await searchDestinationTrack({ title: "  ", artist: "", durationMs: null });
    expect(res).toMatchObject({ ok: false, error: { kind: "unsupported" } });
    expect(destination.searchTrack).not.toHaveBeenCalled();
  });

  it("renvoie l'erreur du provider au lieu de la lever", async () => {
    destination.searchTrack.mockRejectedValue(
      new ProviderError({ kind: "unauthorized", provider: "spotify", message: "Session expirée" }),
    );
    const res = await searchDestinationTrack({ title: "Hide", artist: "", durationMs: 200_000 });
    expect(res).toMatchObject({
      ok: false,
      error: { kind: "unauthorized", message: "Session expirée" },
    });
  });
});

describe("createConvertedPlaylist", () => {
  it("crée la playlist avec des URI Spotify valides", async () => {
    destination.createPlaylist.mockResolvedValue({
      id: "p1",
      url: "https://open.spotify.com/playlist/p1",
    });
    const res = await createConvertedPlaylist({
      name: "French rap",
      description: "",
      trackIds: [URI],
    });
    expect(res).toEqual({
      ok: true,
      data: { id: "p1", url: "https://open.spotify.com/playlist/p1" },
    });
    expect(destination.createPlaylist).toHaveBeenCalledWith({
      name: "French rap",
      description: null,
      trackIds: [URI],
    });
  });

  it.each([
    { name: "", description: null, trackIds: [URI] },
    { name: "x", description: null, trackIds: [] },
    { name: "x", description: null, trackIds: ["spotify:playlist:abc"] },
  ])("refuse une entrée invalide %#", async (input) => {
    const res = await createConvertedPlaylist(input);
    expect(res).toMatchObject({ ok: false, error: { kind: "unsupported" } });
    expect(destination.createPlaylist).not.toHaveBeenCalled();
  });
});

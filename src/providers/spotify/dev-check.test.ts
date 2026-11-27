import { describe, expect, it, vi } from "vitest";
import { ProviderError } from "@/core/errors";
import type { Track } from "@/core/models";
import type { MusicProvider } from "../types";
import { runSpotifyProviderCheck } from "./dev-check";

const found = (id: string): Track => ({
  title: "T",
  artists: ["A"],
  album: null,
  durationMs: 1,
  isrc: "X",
  provider: "spotify",
  providerTrackId: id,
});

function fakeProvider(overrides: Partial<MusicProvider> = {}): MusicProvider {
  return {
    id: "spotify",
    parsePlaylistUrl: () => null,
    searchTrack: vi
      .fn()
      .mockResolvedValueOnce([found("spotify:track:a")])
      .mockResolvedValueOnce([found("spotify:track:b")]),
    createPlaylist: vi.fn().mockResolvedValue({ id: "new", url: "u" }),
    getPlaylist: vi.fn(async (ref) => {
      if (ref.id === "new") return { ref, name: "P", description: null, tracks: [found("a")] };
      throw new ProviderError({ kind: "not_accessible", provider: "spotify", message: "non" });
    }),
    ...overrides,
  };
}

describe("runSpotifyProviderCheck", () => {
  it("enchaîne les 5 étapes ; le refus de la playlist tierce compte comme un succès", async () => {
    const provider = fakeProvider();
    const steps = await runSpotifyProviderCheck(provider);
    expect(steps.map((s) => s.ok)).toEqual([true, true, true, true, true]);
    expect(provider.createPlaylist).toHaveBeenCalledWith(
      expect.objectContaining({ trackIds: ["spotify:track:a", "spotify:track:b"] }),
    );
  });

  it("signale un échec si la playlist tierce est lisible alors qu'elle ne devrait pas", async () => {
    const steps = await runSpotifyProviderCheck(
      fakeProvider({
        getPlaylist: vi.fn(async (ref) => ({ ref, name: "P", description: null, tracks: [] })),
      }),
    );
    expect(steps.at(-1)?.ok).toBe(false);
  });

  it("ne crée pas de playlist si aucune recherche ne trouve", async () => {
    const provider = fakeProvider({ searchTrack: vi.fn().mockResolvedValue([]) });
    await runSpotifyProviderCheck(provider);
    expect(provider.createPlaylist).not.toHaveBeenCalled();
  });
});

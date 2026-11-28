import { describe, expect, it, vi } from "vitest";
import type { MusicProvider } from "@/providers/types";
import {
  buildNewPlaylist,
  findSourceProvider,
  matchPlaylist,
  resolveSource,
  selectCandidate,
} from "./convert";
import { ProviderError } from "./errors";
import type { Playlist, ProviderId, Track } from "./models";

function track(provider: ProviderId, id: string, overrides: Partial<Track> = {}): Track {
  return {
    title: `Titre ${id}`,
    artists: [`Artiste ${id}`],
    album: null,
    durationMs: 200_000,
    isrc: `ISRC${id}`,
    provider,
    providerTrackId: id,
    ...overrides,
  };
}

/** Faux provider en mémoire : `search` décide des candidats renvoyés pour chaque titre. */
function fakeProvider(
  id: ProviderId,
  search: (t: Track) => Promise<Track[]> = async () => [],
  urlPrefix = `https://${id}.test/playlist/`,
): MusicProvider {
  return {
    id,
    parsePlaylistUrl: (url) =>
      url.startsWith(urlPrefix) ? { provider: id, id: url.slice(urlPrefix.length) } : null,
    getPlaylist: async () => {
      throw new Error("non utilisé");
    },
    searchTrack: vi.fn(search),
    createPlaylist: async () => ({ id: "new", url: "https://example.test/new" }),
  };
}

const playlist: Playlist = {
  ref: { provider: "deezer", id: "42" },
  name: "French rap",
  description: null,
  tracks: [
    track("deezer", "1"),
    track("deezer", "2", { isrc: null }),
    track("deezer", "3", { isrc: null }),
  ],
};

/** Destination : 1 trouvé par ISRC, 2 incertain (durée +30 s), 3 introuvable. */
const destination = fakeProvider("spotify", async (t) => {
  if (t.providerTrackId === "1") return [track("spotify", "s1", { isrc: "ISRC1" })];
  if (t.providerTrackId === "2") {
    return [
      track("spotify", "s2", {
        title: "Titre 2",
        artists: ["Artiste 2"],
        isrc: null,
        durationMs: 230_000,
      }),
    ];
  }
  return [];
});

describe("findSourceProvider", () => {
  const deezer = fakeProvider("deezer");
  const spotify = fakeProvider("spotify");

  it("renvoie le provider qui reconnaît le lien et la référence", () => {
    const { provider, ref } = findSourceProvider("  https://spotify.test/playlist/abc ", [
      deezer,
      spotify,
    ]);
    expect(provider.id).toBe("spotify");
    expect(ref).toEqual({ provider: "spotify", id: "abc" });
  });

  it("lève une ProviderError « unsupported » pour un lien inconnu", () => {
    expect(() => findSourceProvider("https://exemple.fr", [deezer, spotify])).toThrowError(
      expect.objectContaining({ name: "ProviderError", kind: "unsupported", provider: null }),
    );
  });
});

describe("matchPlaylist", () => {
  it("classe chaque titre, résume et signale la progression", async () => {
    const onProgress = vi.fn();
    const report = await matchPlaylist({ playlist, destination, onProgress });

    expect(report.results.map((r) => r.status)).toEqual(["found", "uncertain", "not_found"]);
    expect(report.summary).toEqual({
      total: 3,
      found: 1,
      uncertain: 1,
      notFound: 1,
      manual: 0,
      selected: 1,
    });
    expect(report.results[0]!.best?.method).toBe("isrc");
    expect(report.results[1]!.best?.track.providerTrackId).toBe("s2");
    expect(report.results[1]!.selected).toBeNull(); // incertain : exclu par défaut
    expect(onProgress.mock.calls.map(([done, total]) => [done, total])).toEqual([
      [0, 3],
      [1, 3],
      [2, 3],
      [3, 3],
    ]);
    // Chaque titre traité est transmis avec son résultat (pochettes de la progression).
    expect(onProgress.mock.calls[1]![2]).toBe(report.results[0]);
  });

  it("interrompt la conversion sur une erreur qui toucherait tous les titres", async () => {
    const err = new ProviderError({
      kind: "unauthorized",
      provider: "spotify",
      message: "Session expirée",
    });
    const dest = fakeProvider("spotify", async () => {
      throw err;
    });
    await expect(matchPlaylist({ playlist, destination: dest })).rejects.toBe(err);
    expect(dest.searchTrack).toHaveBeenCalledTimes(1);
  });

  it("rattache une erreur propre à un titre et continue", async () => {
    const dest = fakeProvider("spotify", async (t) => {
      if (t.providerTrackId === "2") {
        throw new ProviderError({
          kind: "invalid_response",
          provider: "spotify",
          message: "Réponse inattendue",
        });
      }
      return [];
    });
    const report = await matchPlaylist({ playlist, destination: dest });
    expect(report.results[1]).toMatchObject({
      status: "not_found",
      error: { kind: "invalid_response", message: "Réponse inattendue" },
    });
    expect(dest.searchTrack).toHaveBeenCalledTimes(3);
  });

  it("ne transforme pas une erreur de programmation en « introuvable »", async () => {
    const dest = fakeProvider("spotify", async () => {
      throw new TypeError("bug");
    });
    await expect(matchPlaylist({ playlist, destination: dest })).rejects.toThrow("bug");
  });

  it("s'arrête avant le titre suivant quand la conversion est annulée", async () => {
    const controller = new AbortController();
    const dest = fakeProvider("spotify", async () => {
      controller.abort(new Error("annulée"));
      return [];
    });
    await expect(
      matchPlaylist({ playlist, destination: dest, signal: controller.signal }),
    ).rejects.toThrow("annulée");
    expect(dest.searchTrack).toHaveBeenCalledTimes(1);
  });

  it("playlist vide : rapport vide", async () => {
    const report = await matchPlaylist({ playlist: { ...playlist, tracks: [] }, destination });
    expect(report.summary.total).toBe(0);
  });
});

describe("selectCandidate", () => {
  it("valide un incertain sans modifier le rapport d'origine", async () => {
    const report = await matchPlaylist({ playlist, destination });
    const chosen = report.results[1]!.best!.track;
    const updated = selectCandidate(report, 1, chosen);

    expect(updated.results[1]).toMatchObject({ status: "manual", selected: chosen });
    expect(updated.summary).toMatchObject({ uncertain: 0, manual: 1, selected: 2 });
    expect(report.results[1]!.status).toBe("uncertain");
  });

  it("ajoute un titre trouvé à la main aux candidats, ou retire un titre", async () => {
    const report = await matchPlaylist({ playlist, destination });
    const manual = track("spotify", "s3", { title: "Titre 3", artists: ["Artiste 3"] });
    const withManual = selectCandidate(report, 2, manual);
    expect(withManual.results[2]!.candidates[0]!.track).toBe(manual);

    const removed = selectCandidate(withManual, 0, null);
    expect(removed.results[0]).toMatchObject({ status: "manual", selected: null });
  });

  it("refuse un index absent ou un titre d'une autre plateforme", async () => {
    const report = await matchPlaylist({ playlist, destination });
    expect(() => selectCandidate(report, 9, null)).toThrow(RangeError);
    expect(() => selectCandidate(report, 0, track("deezer", "x"))).toThrow();
  });
});

describe("buildNewPlaylist", () => {
  it("garde les titres sélectionnés, dans l'ordre et sans doublons", async () => {
    let report = await matchPlaylist({ playlist, destination });
    report = selectCandidate(report, 2, report.results[0]!.selected); // doublon de s1
    report = selectCandidate(report, 1, report.results[1]!.best!.track);

    expect(buildNewPlaylist(report, { name: "French rap", description: "Depuis Deezer" })).toEqual({
      name: "French rap",
      description: "Depuis Deezer",
      trackIds: ["s1", "s2"],
    });
  });

  it("exclut les incertains non validés", async () => {
    const report = await matchPlaylist({ playlist, destination });
    expect(buildNewPlaylist(report, { name: "x", description: null }).trackIds).toEqual(["s1"]);
  });
});

describe("resolveSource", () => {
  const deezer: MusicProvider = {
    ...fakeProvider("deezer"),
    expandUrl: vi.fn(async (url: string) =>
      url.startsWith("https://short.test/") ? "https://deezer.test/playlist/42" : null,
    ),
  };
  const spotify = fakeProvider("spotify");

  it("lien direct : pas d'appel à expandUrl", async () => {
    const { ref } = await resolveSource("https://spotify.test/playlist/abc", [deezer, spotify]);
    expect(ref).toEqual({ provider: "spotify", id: "abc" });
    expect(deezer.expandUrl).not.toHaveBeenCalled();
  });

  it("développe un lien court puis reconnaît la playlist", async () => {
    const { provider, ref } = await resolveSource("https://short.test/x", [spotify, deezer]);
    expect(provider.id).toBe("deezer");
    expect(ref).toEqual({ provider: "deezer", id: "42" });
  });

  it("lien inconnu : erreur « unsupported »", async () => {
    await expect(resolveSource("https://exemple.fr", [deezer, spotify])).rejects.toMatchObject({
      kind: "unsupported",
    });
  });
});

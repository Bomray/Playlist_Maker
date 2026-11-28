import { describe, expect, it } from "vitest";
import type { Play } from "./parse";
import {
  matchesSelection,
  type Selection,
  selectionFromParams,
  selectionKey,
  selectionToParams,
} from "./selection";

const play = (over: Partial<Play>): Play => ({
  endedAt: 0,
  msPlayed: 60_000,
  kind: "music",
  title: "Lie",
  artist: "NF",
  album: "Perception",
  uri: "spotify:track:lie",
  skipped: null,
  offlineTs: 0,
  ...over,
});

describe("sélection", () => {
  it("filtre les écoutes d'un artiste, d'un album, d'un titre", () => {
    expect(matchesSelection(play({}), { kind: "artist", artist: "NF" })).toBe(true);
    expect(matchesSelection(play({ artist: "Nekfeu" }), { kind: "artist", artist: "NF" })).toBe(
      false,
    );
    expect(matchesSelection(play({ kind: "podcast" }), { kind: "artist", artist: "NF" })).toBe(
      false,
    );
    expect(
      matchesSelection(play({ album: "The Search" }), {
        kind: "album",
        artist: "NF",
        album: "Perception",
      }),
    ).toBe(false);
    const byUri: Selection = {
      kind: "track",
      artist: "NF",
      title: "Lie",
      uri: "spotify:track:lie",
    };
    expect(matchesSelection(play({ uri: "spotify:track:autre" }), byUri)).toBe(false);
    // Sans URI : par artiste + titre.
    expect(
      matchesSelection(play({ uri: null }), {
        kind: "track",
        artist: "NF",
        title: "Lie",
        uri: null,
      }),
    ).toBe(true);
  });

  it("aller-retour avec les paramètres d'URL", () => {
    const all: Selection[] = [
      { kind: "artist", artist: "Æ & Co" },
      { kind: "album", artist: "NF", album: "Perception" },
      { kind: "track", artist: "NF", title: "Lie", uri: "spotify:track:lie" },
      { kind: "track", artist: "NF", title: "Lie", uri: null },
    ];
    for (const s of all) {
      const params = new URLSearchParams(selectionToParams(s).toString());
      expect(selectionFromParams(params)).toEqual(s);
    }
    expect(selectionFromParams(new URLSearchParams("album=X"))).toBeNull();
    expect(selectionFromParams(new URLSearchParams(""))).toBeNull();
  });

  it("clé identique à celle des tops", () => {
    expect(selectionKey({ kind: "album", artist: "NF", album: "P" })).toBe("NF\u0000P");
    expect(selectionKey({ kind: "track", artist: "NF", title: "Lie", uri: null })).toBe(
      "NF\u0000Lie",
    );
  });
});

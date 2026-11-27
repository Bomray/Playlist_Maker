import { describe, expect, it } from "vitest";
import type { Play } from "@/core/stats";
import {
  decodePlay,
  encodePlay,
  IMPORT_BATCH,
  ImportRequestSchema,
  rowsToPlays,
} from "./stats-sync";

const play: Play = {
  endedAt: Date.parse("2024-03-10T21:15:00Z"),
  msPlayed: 187_000,
  kind: "music",
  title: "Le goût du sel",
  artist: "Bigflo & Oli",
  album: "Karma",
  uri: "spotify:track:abc",
  skipped: false,
  offlineTs: 0,
};

describe("format d'échange", () => {
  it("encode / décode sans perte", () => {
    expect(decodePlay(encodePlay(play))).toEqual(play);
  });

  it("valide les lots : taille, valeurs aberrantes, URI", () => {
    expect(ImportRequestSchema.safeParse({ plays: [encodePlay(play)] }).success).toBe(true);
    expect(
      ImportRequestSchema.safeParse({
        plays: [encodePlay({ ...play, uri: "spotify:local:a:b:c:180" })],
      }).success,
    ).toBe(true);
    expect(ImportRequestSchema.safeParse({ plays: [] }).success).toBe(false);
    expect(
      ImportRequestSchema.safeParse({ plays: Array(IMPORT_BATCH + 1).fill(encodePlay(play)) })
        .success,
    ).toBe(false);
    expect(
      ImportRequestSchema.safeParse({ plays: [encodePlay({ ...play, msPlayed: -1 })] }).success,
    ).toBe(false);
    expect(
      ImportRequestSchema.safeParse({ plays: [encodePlay({ ...play, uri: "https://evil" })] })
        .success,
    ).toBe(false);
    expect(
      ImportRequestSchema.safeParse({ plays: [encodePlay({ ...play, endedAt: 0 })] }).success,
    ).toBe(false);
  });

  it("reconstruit les écoutes depuis le dictionnaire de morceaux", () => {
    const out: Play[] = [];
    rowsToPlays(
      new Map([[7, [7, "Le goût du sel", "Bigflo & Oli", "Karma", "spotify:track:abc", "music"]]]),
      [
        [7, play.endedAt, 187_000, false, 0],
        [99, 1, 1, null, 0],
      ],
      out,
    );
    expect(out).toEqual([play]);
  });
});

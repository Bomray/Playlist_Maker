import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Play } from "@/core/stats";
import { importPlays } from "./history";
import { artistsToFill, findImages, saveArtistImage, saveTrackImage, tracksToFill } from "./images";
import { createTestDb } from "./test-db";
import { upsertUser } from "./users";

let db: Awaited<ReturnType<typeof createTestDb>>;
let userId: string;

const play = (n: number, title: string, uri: string | null, album = "Album"): Play => ({
  endedAt: Date.UTC(2025, 0, 1) + n * 60_000,
  msPlayed: 200_000,
  kind: "music",
  title,
  artist: "Artiste",
  album,
  uri,
  skipped: null,
  offlineTs: 0,
});

beforeEach(async () => {
  db = await createTestDb();
  userId = (
    await upsertUser(db, {
      spotifyUserId: "u",
      displayName: null,
      tokens: { accessTokenEnc: "a", refreshTokenEnc: "r", expiresAt: new Date(), scope: "" },
    })
  ).id;
  await importPlays(
    db,
    userId,
    [
      play(1, "Rare", "spotify:track:rare"),
      play(2, "Tube", "spotify:track:tube"),
      play(3, "Tube", "spotify:track:tube"),
      play(4, "Sans URI", null),
    ],
    "import",
  );
});
afterEach(() => db.close());

describe("images en base", () => {
  it("à remplir : morceaux Spotify, les plus écoutés d'abord", async () => {
    const todo = await tracksToFill(db, 10);
    expect(todo.map((t) => t.spotifyId)).toEqual(["tube", "rare"]);
  });

  it("une fois cherché, un morceau n'est plus à remplir, même sans image", async () => {
    const [tube, rare] = await tracksToFill(db, 10);
    await saveTrackImage(db, tube!, {
      imageUrl: "https://i.scdn.co/image/tube",
      artistSpotifyId: "art1",
    });
    await saveTrackImage(db, rare!, { imageUrl: null, artistSpotifyId: null });
    expect(await tracksToFill(db, 10)).toEqual([]);

    expect(await artistsToFill(db, 10)).toEqual([{ name: "Artiste", spotifyId: "art1" }]);
    await saveArtistImage(db, "Artiste", "https://i.scdn.co/image/artiste");
    expect(await artistsToFill(db, 10)).toEqual([]);
  });

  it("retrouve les images d'un titre, d'un album et d'un artiste", async () => {
    const [tube] = await tracksToFill(db, 1);
    await saveTrackImage(db, tube!, {
      imageUrl: "https://i.scdn.co/image/tube",
      artistSpotifyId: "art1",
    });
    await saveArtistImage(db, "Artiste", "https://i.scdn.co/image/artiste");

    const images = await findImages(db, {
      tracks: [
        { key: "spotify:track:tube", artist: "Artiste", title: "Tube" },
        // Export sans URI : retrouvé par artiste + titre.
        { key: "Artiste\u0000Tube", artist: "Artiste", title: "Tube" },
        { key: "spotify:track:rare", artist: "Artiste", title: "Rare" },
      ],
      artists: ["Artiste", "Inconnu"],
      albums: [{ key: "Artiste\u0000Album", artist: "Artiste", album: "Album" }],
    });
    expect(images).toEqual({
      tracks: {
        "spotify:track:tube": "https://i.scdn.co/image/tube",
        "Artiste\u0000Tube": "https://i.scdn.co/image/tube",
      },
      artists: { Artiste: "https://i.scdn.co/image/artiste" },
      albums: { "Artiste\u0000Album": "https://i.scdn.co/image/tube" },
    });
  });

  it("demande vide : réponse vide", async () => {
    expect(await findImages(db, { tracks: [], artists: [], albums: [] })).toEqual({
      tracks: {},
      artists: {},
      albums: {},
    });
  });
});

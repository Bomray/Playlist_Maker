import { strToU8, zipSync } from "fflate";
import { describe, expect, it, vi } from "vitest";
import { ExportReadError, readExport } from "./read-export";

const entry = (title: string) => ({
  ts: "2024-03-10T21:15:00Z",
  ms_played: 187000,
  ip_addr: "203.0.113.7",
  master_metadata_track_name: title,
  master_metadata_album_artist_name: "Artiste",
  master_metadata_album_album_name: "Album",
  spotify_track_uri: `spotify:track:${title}`,
  episode_name: null,
  episode_show_name: null,
  skipped: false,
});

const json = (value: unknown) => strToU8(JSON.stringify(value));

describe("readExport", () => {
  it("lit l'archive Spotify : seulement les fichiers d'historique, avec progression", () => {
    const zip = zipSync({
      "Spotify Extended Streaming History/Streaming_History_Audio_2023_0.json": json([
        entry("a"),
        entry("b"),
      ]),
      "Spotify Extended Streaming History/Streaming_History_Audio_2024_1.json": json([entry("c")]),
      "Spotify Extended Streaming History/ReadMeFirst_ExtendedStreamingHistory.pdf":
        strToU8("%PDF"),
      "Spotify Account Data/Userdata.json": json({ username: "secret" }),
    });
    const onProgress = vi.fn();
    const result = readExport([{ name: "my_spotify_data.zip", data: zip }], onProgress);

    expect(result.plays.map((p) => p.title).sort()).toEqual(["a", "b", "c"]);
    expect(result.historyFiles).toBe(2);
    expect(onProgress.mock.calls).toEqual([
      [1, 2],
      [2, 2],
    ]);
    expect(JSON.stringify(result)).not.toContain("203.0.113.7");
  });

  it("accepte aussi des fichiers .json déposés directement", () => {
    const result = readExport([
      { name: "Streaming_History_Audio_2024_1.json", data: json([entry("x")]) },
      { name: "YourLibrary.json", data: json([{ track: "ignoré" }]) },
    ]);
    expect(result.plays).toHaveLength(1);
    expect(result.historyFiles).toBe(1);
  });

  it("explique l'erreur quand aucun historique n'est trouvé", () => {
    const zip = zipSync({ "Spotify Account Data/Userdata.json": json({}) });
    expect(() => readExport([{ name: "autre.zip", data: zip }])).toThrow(ExportReadError);
    expect(() => readExport([{ name: "photo.png", data: new Uint8Array([1, 2, 3]) }])).toThrow(
      /Aucun historique/,
    );
  });

  it("JSON invalide : erreur qui nomme le fichier", () => {
    expect(() =>
      readExport([{ name: "Streaming_History_Audio_2024_1.json", data: strToU8("{pas du json") }]),
    ).toThrow(/Streaming_History_Audio_2024_1\.json/);
  });

  it("archive corrompue : erreur typée", () => {
    const broken = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0, 0]);
    expect(() => readExport([{ name: "casse.zip", data: broken }])).toThrow(ExportReadError);
  });
});

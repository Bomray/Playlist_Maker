import { describe, expect, it } from "vitest";
import { isHistoryFileName, parseExportFile } from "./parse";

// Entrée au format « étendu », valeurs inventées. Les champs sensibles sont présents
// pour vérifier qu'ils ne sont jamais conservés.
const extended = {
  ts: "2024-03-10T21:15:00Z",
  platform: "android",
  ms_played: 187000,
  conn_country: "FR",
  ip_addr: "203.0.113.7",
  master_metadata_track_name: "Le goût du sel",
  master_metadata_album_artist_name: "Bigflo & Oli",
  master_metadata_album_album_name: "Karma",
  spotify_track_uri: "spotify:track:000000000000000000000a",
  episode_name: null,
  episode_show_name: null,
  spotify_episode_uri: null,
  reason_start: "trackdone",
  reason_end: "trackdone",
  shuffle: false,
  skipped: false,
  offline: false,
  offline_timestamp: null,
  incognito_mode: false,
};

describe("parseExportFile", () => {
  it("format étendu : garde les champs utiles, jamais IP ni pays", () => {
    const { plays, skippedEntries } = parseExportFile([extended]);
    expect(skippedEntries).toBe(0);
    expect(plays).toEqual([
      {
        endedAt: Date.parse("2024-03-10T21:15:00Z"),
        msPlayed: 187000,
        kind: "music",
        title: "Le goût du sel",
        artist: "Bigflo & Oli",
        album: "Karma",
        uri: "spotify:track:000000000000000000000a",
        skipped: false,
      },
    ]);
    expect(JSON.stringify(plays)).not.toMatch(/203\.0\.113|"FR"/);
  });

  it("format étendu : épisode de podcast", () => {
    const episode = {
      ...extended,
      master_metadata_track_name: null,
      master_metadata_album_artist_name: null,
      master_metadata_album_album_name: null,
      spotify_track_uri: null,
      episode_name: "Épisode 12",
      episode_show_name: "Mon podcast",
    };
    expect(parseExportFile([episode]).plays[0]).toMatchObject({
      kind: "podcast",
      title: "Épisode 12",
      artist: "Mon podcast",
      album: null,
    });
  });

  it("format « Données du compte » (musique et podcasts), date en UTC", () => {
    const { plays } = parseExportFile([
      {
        endTime: "2024-01-31 23:59",
        artistName: "Nekfeu",
        trackName: "On verra",
        msPlayed: 200000,
      },
      {
        endTime: "2024-02-01 08:00",
        podcastName: "Mon podcast",
        episodeName: "Ép. 1",
        msPlayed: 60000,
      },
    ]);
    expect(plays.map((p) => [p.kind, p.title, p.endedAt])).toEqual([
      ["music", "On verra", Date.parse("2024-01-31T23:59:00Z")],
      ["podcast", "Ép. 1", Date.parse("2024-02-01T08:00:00Z")],
    ]);
  });

  it("compte les entrées inutilisables au lieu d'échouer", () => {
    const audiobookOrEmpty = { ...extended, master_metadata_track_name: null, episode_name: null };
    const { plays, skippedEntries } = parseExportFile([
      extended,
      audiobookOrEmpty,
      { foo: 1 },
      { ...extended, ts: "pas une date" },
    ]);
    expect(plays).toHaveLength(1);
    expect(skippedEntries).toBe(3);
  });

  it("contenu qui n'est pas un tableau : rien", () => {
    expect(parseExportFile({ not: "an array" })).toEqual({ plays: [], skippedEntries: 0 });
  });
});

describe("isHistoryFileName", () => {
  it.each([
    "Spotify Extended Streaming History/Streaming_History_Audio_2021-2022_0.json",
    "Streaming_History_Video_2022-2026.json",
    "Spotify Account Data/StreamingHistory_music_0.json",
    "StreamingHistory_podcast_1.json",
    "StreamingHistory0.json",
  ])("reconnaît %s", (name) => expect(isHistoryFileName(name)).toBe(true));

  it.each([
    "ReadMeFirst_ExtendedStreamingHistory.pdf",
    "Userdata.json",
    "YourLibrary.json",
    "Playlist1.json",
  ])("ignore %s", (name) => expect(isHistoryFileName(name)).toBe(false));
});

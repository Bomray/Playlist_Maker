import { describe, expect, it } from "vitest";
import { computeStats, MIN_PLAY_MS, splitDuration } from "./aggregate";
import type { Play } from "./parse";

function play(iso: string, msPlayed: number, o: Partial<Play> = {}): Play {
  return {
    endedAt: Date.parse(iso),
    msPlayed,
    kind: "music",
    title: "Titre A",
    artist: "Artiste 1",
    album: "Album X",
    uri: "spotify:track:a",
    skipped: false,
    offlineTs: 0,
    ...o,
  };
}

const plays: Play[] = [
  play("2023-12-31T22:30:00Z", 180_000), // 23:30 à Paris, 31/12/2023 (dimanche)
  play("2024-01-01T10:00:00Z", 200_000), // 11:00 à Paris, lundi
  play("2024-01-01T10:05:00Z", 10_000), // passé (< 30 s)
  play("2024-01-02T18:00:00Z", 240_000, {
    title: "Titre B",
    uri: "spotify:track:b",
    artist: "Artiste 2",
    album: "Album Y",
  }),
  play("2024-01-03T08:00:00Z", 1_800_000, {
    kind: "podcast",
    title: "Ép. 1",
    artist: "Podcast",
    album: null,
    uri: null,
  }),
];

const paris = { timeZone: "Europe/Paris" };

describe("computeStats", () => {
  it("temps total (toutes lectures), écoutes à partir de 30 s, podcasts à part", () => {
    const s = computeStats(plays, paris);
    expect(s.music).toEqual({
      msPlayed: 180_000 + 200_000 + 10_000 + 240_000,
      plays: 3,
      shortPlays: 1,
      distinctTracks: 2,
      distinctArtists: 2,
      activeDays: 3,
    });
    expect(s.podcasts).toEqual({ msPlayed: 1_800_000, episodes: 1 });
    expect(s.range).toEqual({ first: plays[0]!.endedAt, last: plays[4]!.endedAt });
  });

  it("tops classés par écoutes puis par temps", () => {
    const s = computeStats(plays, paris);
    expect(s.topTracks.map((t) => [t.label, t.plays, t.msPlayed])).toEqual([
      ["Titre A", 2, 390_000],
      ["Titre B", 1, 240_000],
    ]);
    expect(s.topArtists[0]).toMatchObject({ label: "Artiste 1", sublabel: null, plays: 2 });
    expect(s.topAlbums.map((a) => a.label)).toEqual(["Album X", "Album Y"]);
  });

  it("répartit dans le fuseau demandé (année, mois, jour de semaine, heure)", () => {
    const s = computeStats(plays, paris);
    expect(s.byYear.map((b) => [b.key, b.plays])).toEqual([
      ["2023", 1],
      ["2024", 2],
    ]);
    expect(s.byMonth.map((b) => b.key)).toEqual(["2023-12", "2024-01"]);
    expect(s.byDay.map((b) => b.key)[0]).toMatch(/^2023-12-\d{2}$/);
    expect(s.byDay.reduce((n, b) => n + b.msPlayed, 0)).toBe(s.music.msPlayed);
    expect(s.byHour[23]!.plays).toBe(1); // 22:30 UTC = 23:30 à Paris
    expect(s.byHour[11]!.plays).toBe(1);
    expect(s.byWeekday[6]!.plays).toBe(1); // dimanche
    expect(s.byWeekday).toHaveLength(7);
    expect(s.byHour).toHaveLength(24);

    // En UTC, la première écoute tombe à 22 h.
    expect(computeStats(plays, { timeZone: "UTC" }).byHour[22]!.plays).toBe(1);
  });

  it("gère les fuseaux décalés d'une demi-heure", () => {
    // 10:45 UTC = 16:15 en Inde (+5:30)
    const s = computeStats([play("2024-01-01T10:45:00Z", 200_000)], { timeZone: "Asia/Kolkata" });
    expect(s.byHour[16]!.plays).toBe(1);
  });

  it("filtre une période (bornes incluses)", () => {
    const s = computeStats(plays, {
      ...paris,
      from: Date.parse("2024-01-01T00:00:00Z"),
      to: Date.parse("2024-01-01T23:59:59Z"),
    });
    expect(s.music.plays).toBe(1);
    expect(s.music.shortPlays).toBe(1);
    expect(s.podcasts.episodes).toBe(0);
  });

  it("aucune lecture : stats vides", () => {
    const s = computeStats([], paris);
    expect(s.range).toBeNull();
    expect(s.topTracks).toEqual([]);
    expect(s.byHour.every((b) => b.plays === 0)).toBe(true);
  });

  it("titres sans URI (format compte) identifiés par artiste + titre", () => {
    const s = computeStats(
      [
        play("2024-01-01T10:00:00Z", 60_000, { uri: null }),
        play("2024-01-01T11:00:00Z", 60_000, { uri: null }),
      ],
      paris,
    );
    expect(s.topTracks).toHaveLength(1);
    expect(s.topTracks[0]!.plays).toBe(2);
  });

  it("seuil de 30 s inclus", () => {
    expect(computeStats([play("2024-01-01T10:00:00Z", MIN_PLAY_MS)], paris).music.plays).toBe(1);
  });
});

describe("splitDuration", () => {
  it("minutes, heures et jours arrondis", () => {
    expect(splitDuration(45_872_990_581)).toEqual({ minutes: 764_550, hours: 12_742, days: 530.9 });
  });
});

describe("tops : union écoutes / temps", () => {
  it("garde un titre long peu écouté qui serait dans le top par temps", () => {
    const many: Play[] = [];
    // 50 titres écoutés 2 fois (3 min), puis 1 titre très long écouté une fois (2 h).
    for (let i = 0; i < 50; i++) {
      many.push(play("2024-01-01T10:00:00Z", 180_000, { uri: `u${i}`, title: `T${i}` }));
      many.push(play("2024-01-01T11:00:00Z", 180_000, { uri: `u${i}`, title: `T${i}` }));
    }
    many.push(play("2024-01-02T10:00:00Z", 7_200_000, { uri: "long", title: "Mix de 2 h" }));
    const s = computeStats(many, { timeZone: "UTC" });
    expect(s.topTracks.some((t) => t.label === "Mix de 2 h")).toBe(true);
    expect(s.topTracks.at(-1)!.label).toBe("Mix de 2 h"); // trié par écoutes : en dernier
  });

  it("se limite à la sélection (page artiste)", () => {
    const s = computeStats(plays, { ...paris, selection: { kind: "artist", artist: "Artiste 1" } });
    expect(s.topArtists.map((a) => a.label)).toEqual(["Artiste 1"]);
    expect(s.podcasts.msPlayed).toBe(0);
  });
});

import { describe, expect, it } from "vitest";
import type { Track } from "../models";
import { FOUND_THRESHOLD, matchTrack, UNCERTAIN_THRESHOLD } from "./match";
import { scoreCandidate, VERSION_MISMATCH_CAP } from "./score";

function track(overrides: Partial<Track> = {}): Track {
  return {
    title: "Le cœur des filles",
    artists: ["A2H"],
    album: "Rédemption",
    durationMs: 219_000,
    isrc: "FRPJQ1501640",
    provider: "deezer",
    providerTrackId: "1068757022",
    ...overrides,
  };
}

const source = track();
const candidate = (o: Partial<Track> = {}) =>
  track({ provider: "spotify", providerTrackId: "spotify:track:x", isrc: null, ...o });

describe("scoreCandidate", () => {
  it("même ISRC → 1 par ISRC, même si le titre est écrit autrement", () => {
    const s = scoreCandidate(
      source,
      candidate({ isrc: "frpjq-1501640", title: "Coeur des filles" }),
    );
    expect(s).toMatchObject({ score: 1, method: "isrc" });
  });

  it("titre, artiste et durée identiques sans ISRC → trouvé", () => {
    const s = scoreCandidate(
      source,
      candidate({ title: "Le coeur des filles", durationMs: 221_000 }),
    );
    expect(s.method).toBe("metadata");
    expect(s.score).toBeGreaterThanOrEqual(FOUND_THRESHOLD);
    expect(s.details).toMatchObject({ title: 1, artist: 1, duration: 1, versionMismatch: false });
  });

  it("un remaster reste le même titre", () => {
    const s = scoreCandidate(source, candidate({ title: "Le cœur des filles - Remastered 2020" }));
    expect(s.score).toBeGreaterThanOrEqual(FOUND_THRESHOLD);
  });

  it("un remix est plafonné : jamais trouvé automatiquement", () => {
    const s = scoreCandidate(source, candidate({ title: "Le cœur des filles (DJ Remix)" }));
    expect(s.details.versionMismatch).toBe(true);
    expect(s.score).toBe(VERSION_MISMATCH_CAP);
  });

  it("durée inconnue : le poids est réparti sur titre et artiste", () => {
    const s = scoreCandidate(source, candidate({ durationMs: null }));
    expect(s.details.duration).toBeNull();
    expect(s.score).toBe(1);
  });

  it("le featuring cité dans le titre compte comme artiste", () => {
    const src = track({ title: "Hide (feat. Seezyn)", artists: ["Juice WRLD"], isrc: null });
    const s = scoreCandidate(src, candidate({ title: "Hide", artists: ["Juice WRLD", "Seezyn"] }));
    expect(s.score).toBeGreaterThanOrEqual(FOUND_THRESHOLD);
  });
});

describe("matchTrack", () => {
  it("found : le meilleur candidat est sélectionné", () => {
    const m = matchTrack(source, [
      candidate({ providerTrackId: "a", title: "Autre chose", artists: ["X"] }),
      candidate({ providerTrackId: "b", title: "Le coeur des filles" }),
    ]);
    expect(m.status).toBe("found");
    expect(m.selected?.providerTrackId).toBe("b");
    expect(m.candidates.map((c) => c.track.providerTrackId)).toEqual(["b", "a"]);
  });

  it("uncertain : durée trop différente, candidat proposé mais pas sélectionné", () => {
    const m = matchTrack(source, [
      candidate({ durationMs: 219_000 + 30_000, artists: ["A2H Officiel"] }),
    ]);
    expect(m.best!.score).toBeGreaterThanOrEqual(UNCERTAIN_THRESHOLD);
    expect(m.best!.score).toBeLessThan(FOUND_THRESHOLD);
    expect(m.status).toBe("uncertain");
    expect(m.best).not.toBeNull();
    expect(m.selected).toBeNull();
  });

  it("not_found : aucun candidat, ou aucun crédible", () => {
    expect(matchTrack(source, [])).toMatchObject({
      status: "not_found",
      best: null,
      selected: null,
    });
    const m = matchTrack(source, [
      candidate({ title: "Sous une averse", artists: ["Lonepsi"], durationMs: 143_000 }),
    ]);
    expect(m.status).toBe("not_found");
    expect(m.selected).toBeNull();
  });

  it("dédoublonne les candidats et en garde 5 au plus", () => {
    const many = Array.from({ length: 8 }, (_, i) => candidate({ providerTrackId: `id${i % 7}` }));
    expect(matchTrack(source, many).candidates).toHaveLength(5);
  });
});

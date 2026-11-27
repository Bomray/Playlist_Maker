import { describe, expect, it } from "vitest";
import { type ConversionReport, summarize } from "@/core/convert";
import { matchTrack } from "@/core/matching";
import type { Track } from "@/core/models";
import type { UserError } from "@/lib/user-error";
import {
  type ConversionState,
  conversionReducer as reduce,
  initialState,
  playlistToCreate,
} from "./conversion-state";

const URI = (n: number) => `spotify:track:${String(n).padStart(22, "0")}`;

function track(provider: Track["provider"], id: string, o: Partial<Track> = {}): Track {
  return {
    title: `T${id}`,
    artists: ["A"],
    album: null,
    durationMs: 200_000,
    isrc: null,
    provider,
    providerTrackId: id,
    ...o,
  };
}

const sources = [track("deezer", "1", { isrc: "I1" }), track("deezer", "2"), track("deezer", "3")];
const results = [
  matchTrack(sources[0]!, [track("spotify", URI(1), { isrc: "I1" })]), // trouvé
  matchTrack(sources[1]!, [
    track("spotify", URI(2), { title: "T2", durationMs: 260_000, artists: ["Autre A"] }),
  ]), // incertain
  matchTrack(sources[2]!, []), // introuvable
];
const report: ConversionReport = {
  playlist: {
    ref: { provider: "deezer", id: "42" },
    name: "Ma playlist",
    description: null,
    tracks: sources,
  },
  destination: "spotify",
  results,
  summary: summarize(results),
};
const error: UserError = {
  kind: "unauthorized",
  provider: "spotify",
  message: "Session expirée",
  retryAfterSeconds: null,
};

function review(): ConversionState {
  const s = reduce(reduce(initialState, { type: "start", url: "u" }), { type: "done", report });
  if (s.phase !== "review") throw new Error("phase inattendue");
  return s;
}

describe("conversionReducer", () => {
  it("lien → progression → récap", () => {
    let s = reduce(initialState, { type: "start", url: "https://deezer.com/playlist/42" });
    s = reduce(s, { type: "playlist", name: "Ma playlist", source: "deezer", total: 3 });
    s = reduce(s, { type: "progress", done: 2, total: 3 });
    expect(s).toMatchObject({ phase: "running", playlistName: "Ma playlist", done: 2, total: 3 });
    s = reduce(s, { type: "done", report });
    expect(s).toMatchObject({
      phase: "review",
      initialStatuses: ["found", "uncertain", "not_found"],
    });
  });

  it("erreur pendant la conversion : retour au formulaire avec le message", () => {
    const s = reduce(reduce(initialState, { type: "start", url: "u" }), { type: "failed", error });
    expect(s).toEqual({ phase: "idle", error });
  });

  it("annulation : retour à l'état initial, et la progression tardive est ignorée", () => {
    let s = reduce(reduce(initialState, { type: "start", url: "u" }), { type: "cancel" });
    s = reduce(s, { type: "progress", done: 1, total: 3 });
    expect(s).toEqual(initialState);
  });

  it("une correction ne change pas le titre de section", () => {
    const s = reduce(review(), { type: "select", index: 1, track: results[1]!.best!.track });
    if (s.phase !== "review") throw new Error("phase inattendue");
    expect(s.report.results[1]!.status).toBe("manual");
    expect(s.initialStatuses[1]).toBe("uncertain");
    expect(s.report.summary.selected).toBe(2);
  });

  it("échec de création : on reste sur le récap, avec les corrections", () => {
    let s: ConversionState = reduce(review(), {
      type: "select",
      index: 1,
      track: results[1]!.best!.track,
    });
    s = reduce(s, { type: "creating" });
    expect(s.phase).toBe("creating");
    s = reduce(s, { type: "failed", error });
    expect(s).toMatchObject({ phase: "review", error });
    if (s.phase === "review") expect(s.report.summary.selected).toBe(2);
  });

  it("création réussie", () => {
    let s: ConversionState = reduce(review(), { type: "creating" });
    s = reduce(s, {
      type: "created",
      created: { id: "p", url: "https://open.spotify.com/playlist/p" },
      added: 1,
    });
    expect(s).toMatchObject({ phase: "created", added: 1 });
    expect(reduce(s, { type: "reset" })).toEqual(initialState);
  });
});

describe("playlistToCreate", () => {
  it("garde les sélectionnés et nettoie nom et description", () => {
    expect(playlistToCreate(report, "  Ma playlist ", "  ")).toEqual({
      name: "Ma playlist",
      description: null,
      trackIds: [URI(1)],
    });
  });
});

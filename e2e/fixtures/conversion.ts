import type { Page } from "@playwright/test";
import { type ConversionReport, summarize } from "../../src/core/convert";
import { matchTrack } from "../../src/core/matching";
import type { Track } from "../../src/core/models";
import { seal } from "../../src/lib/crypto-box";
import { E2E_BASE_URL, E2E_SESSION_SECRET, E2E_USER_ID } from "../env";

// Le serveur n'appelle ni Deezer ni Spotify ici : la route /api/convert est simulée
// dans le navigateur, et la session est celle de l'utilisateur de test préparé en base.

const URI = (n: number) => `spotify:track:${String(n).padStart(22, "0")}`;

function track(provider: Track["provider"], id: string, o: Partial<Track> = {}): Track {
  return {
    title: `Titre ${id}`,
    artists: ["Artiste"],
    album: null,
    durationMs: 200_000,
    isrc: null,
    provider,
    providerTrackId: id,
    ...o,
  };
}

const sources = [
  track("deezer", "1", { title: "Le cœur des filles", artists: ["A2H"], isrc: "FRPJQ1501640" }),
  track("deezer", "2", { title: "Hide", artists: ["Juice WRLD"] }),
  track("deezer", "3", { title: "Inconnu au bataillon", artists: ["Personne"] }),
];
const results = [
  matchTrack(sources[0]!, [
    track("spotify", URI(1), {
      title: "Le coeur des filles",
      artists: ["A2H"],
      isrc: "FRPJQ1501640",
    }),
  ]),
  matchTrack(sources[1]!, [
    track("spotify", URI(2), { title: "Hide", artists: ["Juice WRLD"], durationMs: 260_000 }),
  ]),
  matchTrack(sources[2]!, []),
];
export const report: ConversionReport = {
  playlist: {
    ref: { provider: "deezer", id: "42" },
    name: "French rap",
    description: null,
    tracks: sources,
  },
  destination: "spotify",
  results,
  summary: summarize(results),
};

/** Session de l'utilisateur de test créé par scripts/e2e-seed.mts (cookie chiffré). */
export async function signIn(page: Page) {
  await page.context().addCookies([
    {
      name: "pm_session",
      value: seal({ userId: E2E_USER_ID }, E2E_SESSION_SECRET),
      url: E2E_BASE_URL,
    },
  ]);
}

export async function mockConvert(page: Page, lines: string) {
  await page.route("**/api/convert", (route) =>
    route.fulfill({ status: 200, contentType: "application/x-ndjson", body: lines }),
  );
}

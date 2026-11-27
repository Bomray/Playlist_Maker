import type { Page } from "@playwright/test";
import { type ConversionReport, summarize } from "../../src/core/convert";
import { matchTrack } from "../../src/core/matching";
import type { Track } from "../../src/core/models";
import { seal } from "../../src/lib/crypto-box";

// Le serveur n'appelle ni Deezer ni Spotify ici : la route /api/convert est simulée
// dans le navigateur, et la session Spotify est un cookie factice chiffré avec le
// même secret que le serveur.

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

export async function signIn(page: Page) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET manquant (.env.local)");
  const session = {
    accessToken: "faux",
    refreshToken: "faux",
    expiresAt: Date.now() + 3_600_000,
    scope: "playlist-modify-private playlist-read-private user-read-private",
  };
  await page
    .context()
    .addCookies([
      { name: "pm_spotify_session", value: seal(session, secret), url: "http://127.0.0.1:3000" },
    ]);
}

export async function mockConvert(page: Page, lines: string) {
  await page.route("**/api/convert", (route) =>
    route.fulfill({ status: 200, contentType: "application/x-ndjson", body: lines }),
  );
}

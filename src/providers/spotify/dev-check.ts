// TEMPORAIRE : vérification du provider Spotify contre la vraie API, utilisée par
// /dev/spotify. À supprimer avec la page quand l'UI de conversion existera.
import { ProviderError, type ProviderErrorKind } from "@/core/errors";
import type { Track } from "@/core/models";
import type { MusicProvider } from "../types";

export interface StepResult {
  label: string;
  request: string;
  ok: boolean;
  output: string;
  httpStatus: number | null;
  errorKind: string | null;
}

/** Titre venant de Deezer, avec ISRC. */
const WITH_ISRC: Track = {
  title: "Cut To The Feeling",
  artists: ["Carly Rae Jepsen"],
  album: null,
  durationMs: 207_000,
  isrc: "USUM71703861",
  provider: "deezer",
  providerTrackId: "deezer-test-1",
};

/** Même cas sans ISRC : force la recherche par titre et artiste. */
const WITHOUT_ISRC: Track = {
  title: "Le cœur des filles",
  artists: ["A2H"],
  album: "Rédemption",
  durationMs: 219_000,
  isrc: null,
  provider: "deezer",
  providerTrackId: "1068757022",
};

// Playlist éditoriale Spotify (« Today's Top Hits ») : Spotify répond 404 aux nouvelles apps.
const FOREIGN_PLAYLIST = "37i9dQZF1DXcBWIGoYBM5M";

function pretty(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function errorOutput(e: ProviderError): string {
  if (!e.detail) return e.message;
  try {
    return `${e.message}\n\n${pretty(JSON.parse(e.detail))}`;
  } catch {
    return `${e.message}\n\n${e.detail}`;
  }
}

async function step<T>(
  results: StepResult[],
  label: string,
  request: string,
  run: () => Promise<T>,
  describe: (value: T) => unknown,
  expectedErrors: ProviderErrorKind[] = [],
): Promise<T | null> {
  try {
    const value = await run();
    const unexpected = expectedErrors.length > 0;
    results.push({
      label,
      request,
      ok: !unexpected,
      output: unexpected
        ? `Erreur « ${expectedErrors.join(" » ou « ")} » attendue, mais l'appel a réussi :\n${pretty(describe(value))}`
        : pretty(describe(value)),
      httpStatus: null,
      errorKind: null,
    });
    return value;
  } catch (e) {
    if (!(e instanceof ProviderError)) throw e;
    const expected = expectedErrors.includes(e.kind);
    results.push({
      label,
      request,
      ok: expected,
      output: expected ? `Erreur attendue.\n\n${errorOutput(e)}` : errorOutput(e),
      httpStatus: e.status,
      errorKind: e.kind,
    });
    return null;
  }
}

/** Recherche (avec et sans ISRC), création, relecture, puis lecture refusée d'une playlist tierce. */
export async function runSpotifyProviderCheck(spotify: MusicProvider): Promise<StepResult[]> {
  const results: StepResult[] = [];
  const summary = (tracks: Track[]) =>
    tracks
      .slice(0, 3)
      .map((t) => `${t.artists.join(", ")} — ${t.title} (${t.isrc ?? "sans ISRC"})`);

  const byIsrc = await step(
    results,
    `searchTrack avec ISRC (${WITH_ISRC.isrc})`,
    "GET /v1/search?q=isrc:…",
    () => spotify.searchTrack(WITH_ISRC),
    summary,
  );
  const byText = await step(
    results,
    `searchTrack sans ISRC (« ${WITHOUT_ISRC.title} », ${WITHOUT_ISRC.artists[0]})`,
    'GET /v1/search?q=track:"…" artist:"…"',
    () => spotify.searchTrack(WITHOUT_ISRC),
    summary,
  );

  const trackIds = [byIsrc?.[0], byText?.[0]].flatMap((t) => (t ? [t.providerTrackId] : []));
  if (trackIds.length > 0) {
    const created = await step(
      results,
      `createPlaylist avec ${trackIds.length} titre(s)`,
      "POST /v1/me/playlists puis POST /v1/playlists/{id}/items",
      () =>
        spotify.createPlaylist({
          name: "Playlist_Maker test provider",
          description: "Test du provider Spotify (Development Mode), à supprimer.",
          trackIds,
        }),
      (c) => c,
    );
    if (created) {
      await step(
        results,
        "getPlaylist sur la playlist créée",
        `GET /v1/playlists/${created.id}/items`,
        () => spotify.getPlaylist({ provider: "spotify", id: created.id }),
        (p) => ({ name: p.name, titres: summary(p.tracks), nombre: p.tracks.length }),
      );
    }
  }

  await step(
    results,
    "getPlaylist sur une playlist éditoriale (refus attendu)",
    `GET /v1/playlists/${FOREIGN_PLAYLIST}`,
    () => spotify.getPlaylist({ provider: "spotify", id: FOREIGN_PLAYLIST }),
    (p) => ({ name: p.name, nombre: p.tracks.length }),
    ["not_found", "not_accessible"],
  );
  return results;
}

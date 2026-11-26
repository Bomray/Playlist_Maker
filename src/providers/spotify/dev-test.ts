// TEMPORAIRE : test d'écriture Spotify en Development Mode, utilisé par /dev/spotify.
// À supprimer une fois le vrai provider Spotify écrit.
import { z } from "zod";
import { ProviderError } from "@/core/errors";
import { fetchJson } from "@/lib/http";

const API = "https://api.spotify.com/v1";
export const TEST_ISRC = "USUM71703861";
export const TEST_PLAYLIST_NAME = "Playlist_Maker test";

export interface StepResult {
  label: string;
  request: string;
  ok: boolean;
  /** Données utiles en cas de succès, ou détail de l'erreur. */
  output: string;
  httpStatus: number | null;
  errorKind: string | null;
}

const SearchSchema = z.object({
  tracks: z.object({
    items: z.array(
      z.object({
        uri: z.string(),
        name: z.string(),
        artists: z.array(z.object({ name: z.string() })),
        external_ids: z.object({ isrc: z.string().optional() }).optional(),
      }),
    ),
  }),
});
const CreatedSchema = z.object({
  id: z.string(),
  name: z.string(),
  public: z.boolean().nullable().optional(),
  external_urls: z.object({ spotify: z.string() }),
});
const AddedSchema = z.object({ snapshot_id: z.string() });

function pretty(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

/** Affiche le corps exact renvoyé par Spotify, joliment si c'est du JSON. */
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
): Promise<T | null> {
  try {
    const value = await run();
    results.push({
      label,
      request,
      ok: true,
      output: pretty(describe(value)),
      httpStatus: null,
      errorKind: null,
    });
    return value;
  } catch (e) {
    if (!(e instanceof ProviderError)) throw e;
    results.push({
      label,
      request,
      ok: false,
      output: errorOutput(e),
      httpStatus: e.status,
      errorKind: e.kind,
    });
    return null;
  }
}

/** Recherche par ISRC → création d'une playlist privée → ajout du titre. S'arrête à la première erreur. */
export async function runSpotifyWriteTest(accessToken: string): Promise<StepResult[]> {
  const results: StepResult[] = [];
  const auth = { Authorization: `Bearer ${accessToken}` };
  const json = { ...auth, "Content-Type": "application/json" };

  const search = await step(
    results,
    `Recherche par ISRC ${TEST_ISRC}`,
    `GET /v1/search?q=isrc:${TEST_ISRC}&type=track&limit=1`,
    () =>
      fetchJson(`${API}/search?q=isrc:${TEST_ISRC}&type=track&limit=1`, SearchSchema, {
        provider: "spotify",
        headers: auth,
        cache: "no-store",
      }),
    (r) => r.tracks.items[0] ?? "Aucun résultat",
  );
  const track = search?.tracks.items[0];
  if (!track) {
    if (search) {
      results.push({
        label: "Titre introuvable",
        request: "-",
        ok: false,
        output: `Aucun titre pour l'ISRC ${TEST_ISRC}`,
        httpStatus: null,
        errorKind: "not_found",
      });
    }
    return results;
  }

  const playlist = await step(
    results,
    `Création de la playlist privée « ${TEST_PLAYLIST_NAME} »`,
    "POST /v1/me/playlists",
    () =>
      fetchJson(`${API}/me/playlists`, CreatedSchema, {
        provider: "spotify",
        method: "POST",
        headers: json,
        body: JSON.stringify({
          name: TEST_PLAYLIST_NAME,
          public: false,
          description: "Test d'écriture Playlist_Maker (Development Mode), à supprimer.",
        }),
        cache: "no-store",
      }),
    (p) => p,
  );
  if (!playlist) return results;

  await step(
    results,
    `Ajout de « ${track.name} » à la playlist`,
    `POST /v1/playlists/${playlist.id}/items`,
    () =>
      fetchJson(`${API}/playlists/${playlist.id}/items`, AddedSchema, {
        provider: "spotify",
        method: "POST",
        headers: json,
        body: JSON.stringify({ uris: [track.uri] }),
        cache: "no-store",
      }),
    (r) => ({ ...r, playlist: playlist.external_urls.spotify }),
  );
  return results;
}

// Provider Spotify : destination V1 (recherche + création), et source limitée
// aux playlists de l'utilisateur connecté (restriction du Development Mode).
import type { z } from "zod";
import { ProviderError } from "@/core/errors";
import type { CreatedPlaylist, NewPlaylist, Playlist, PlaylistRef, Track } from "@/core/models";
import type { MusicProvider } from "../types";
import { createSpotifyApi, type SpotifyApiDeps } from "./api";
import {
  PlaylistItemsPageSchema,
  PlaylistResponseSchema,
  SearchResponseSchema,
  SnapshotSchema,
  type SpotifyTrack,
} from "./schemas";
import { parseSpotifyPlaylistUrl } from "./url";

const SEARCH_LIMIT = 10; // au-delà : HTTP 400 « Invalid limit » (constaté pendant le spike)
const ADD_BATCH = 100; // maximum d'URI par appel à POST /playlists/{id}/items
const ITEMS_PAGE = 50;
const MAX_PAGES = 200; // garde-fou contre une pagination sans fin

function toTrack(t: SpotifyTrack): Track {
  return {
    title: t.name,
    artists: t.artists.map((a) => a.name),
    album: t.album?.name ?? null,
    durationMs: t.duration_ms,
    isrc: t.external_ids?.isrc ?? null,
    provider: "spotify",
    // L'URI (spotify:track:…) sert directement pour l'ajout à une playlist.
    providerTrackId: t.uri,
    // La plus petite pochette d'au moins 200 px (Spotify en donne 64, 300 et 640).
    artworkUrl:
      [...(t.album?.images ?? [])]
        .sort((a, b) => (a.width ?? 0) - (b.width ?? 0))
        .find((i) => (i.width ?? 0) >= 200)?.url ?? t.album?.images?.[0]?.url,
  };
}

/** Titre réellement présent sur Spotify (pas un fichier local ni un épisode de podcast). */
function isCatalogTrack(t: SpotifyTrack): boolean {
  return !t.is_local && t.id !== null && (t.type === undefined || t.type === "track");
}

/** Les guillemets casseraient la syntaxe `track:"…"` de la recherche Spotify. */
function clean(text: string): string {
  return text.replace(/"/g, " ").replace(/\s+/g, " ").trim();
}

/** Requêtes essayées dans l'ordre, de la plus précise à la plus large. */
export function buildSearchQueries(track: Track): string[] {
  const queries: string[] = [];
  if (track.isrc) queries.push(`isrc:${track.isrc}`);
  const title = clean(track.title);
  const artist = clean(track.artists[0] ?? "");
  if (title && artist) queries.push(`track:"${title}" artist:"${artist}"`);
  if (title) queries.push(artist ? `${title} ${artist}` : title);
  return queries;
}

export function createSpotifyProvider(deps: SpotifyApiDeps): MusicProvider {
  const api = createSpotifyApi(deps);

  async function search(q: string): Promise<Track[]> {
    const params = new URLSearchParams({
      q,
      type: "track",
      limit: String(SEARCH_LIMIT),
      // Seulement les titres écoutables dans le pays de l'utilisateur connecté.
      market: "from_token",
    });
    const res = await api.get(`/search?${params.toString()}`, SearchResponseSchema);
    return res.tracks.items.filter(isCatalogTrack).map(toTrack);
  }

  return {
    id: "spotify",

    parsePlaylistUrl: parseSpotifyPlaylistUrl,

    async searchTrack(track) {
      for (const q of buildSearchQueries(track)) {
        const results = await search(q);
        if (results.length > 0) return results;
      }
      return [];
    },

    async createPlaylist(playlist: NewPlaylist): Promise<CreatedPlaylist> {
      const created = await api.post(
        "/me/playlists",
        {
          name: playlist.name,
          public: false,
          ...(playlist.description ? { description: playlist.description } : {}),
        },
        PlaylistResponseSchema,
      );
      for (let i = 0; i < playlist.trackIds.length; i += ADD_BATCH) {
        await api.post(
          `/playlists/${created.id}/items`,
          { uris: playlist.trackIds.slice(i, i + ADD_BATCH) },
          SnapshotSchema,
        );
      }
      return { id: created.id, url: created.external_urls.spotify };
    },

    async getPlaylist(ref: PlaylistRef): Promise<Playlist> {
      if (ref.provider !== "spotify") {
        throw new Error(`Référence ${ref.provider} passée au provider Spotify`);
      }
      const meta = await api.get(`/playlists/${ref.id}`, PlaylistResponseSchema).catch((e) => {
        // Depuis fin 2024, les playlists créées par Spotify (éditoriales, Daily Mix…)
        // répondent 404 aux nouvelles applications : on le précise à l'utilisateur.
        if (e instanceof ProviderError && e.kind === "not_found") {
          throw new ProviderError(
            {
              kind: "not_found",
              provider: "spotify",
              status: e.status,
              message:
                "Playlist introuvable. Les playlists créées par Spotify (éditoriales, Daily Mix…) ne sont pas accessibles depuis cette application.",
              detail: e.detail,
            },
            { cause: e },
          );
        }
        throw e;
      });

      const tracks: Track[] = [];
      let next: string | null = `/playlists/${ref.id}/items?limit=${ITEMS_PAGE}`;
      try {
        for (let page = 0; next; page++) {
          if (page >= MAX_PAGES) {
            throw new ProviderError({
              kind: "invalid_response",
              provider: "spotify",
              message: `Pagination interrompue après ${MAX_PAGES} pages`,
            });
          }
          const res: z.infer<typeof PlaylistItemsPageSchema> = await api.get(
            next,
            PlaylistItemsPageSchema,
          );
          for (const it of res.items) {
            const t = it.track ?? it.item;
            if (t && isCatalogTrack(t)) tracks.push(toTrack(t));
          }
          next = res.next;
        }
      } catch (e) {
        // En Development Mode, Spotify refuse les titres d'une playlist qui n'est pas à l'utilisateur.
        if (e instanceof ProviderError && (e.kind === "forbidden" || e.kind === "unauthorized")) {
          throw new ProviderError(
            {
              kind: "not_accessible",
              provider: "spotify",
              status: e.status,
              message:
                "Spotify ne permet de lire que tes propres playlists (ou celles où tu es collaborateur).",
              detail: e.detail,
            },
            { cause: e },
          );
        }
        throw e;
      }

      return { ref, name: meta.name, description: meta.description || null, tracks };
    },
  };
}

// Provider Deezer : source V1 en lecture seule (API publique, sans clé).
import type { z } from "zod";
import { ProviderError } from "@/core/errors";
import type { Playlist, PlaylistRef, Track } from "@/core/models";
import type { MusicProvider } from "../types";
import { createDeezerClient, type DeezerClient } from "./client";
import { type DeezerTrackSchema, DeezerPlaylistSchema, DeezerTracksPageSchema } from "./schemas";
import { parseDeezerPlaylistUrl } from "./url";

const PAGE_SIZE = 100;
// Garde-fou contre une pagination qui ne s'arrêterait pas (Deezer plafonne à 2000 titres).
const MAX_PAGES = 50;

function toTrack(t: z.infer<typeof DeezerTrackSchema>): Track {
  return {
    title: t.title,
    // L'endpoint playlist ne donne que l'artiste principal (les featurings demandent /track/{id}).
    artists: [t.artist.name],
    album: t.album?.title ?? null,
    durationMs: t.duration * 1000,
    isrc: t.isrc || null,
    provider: "deezer",
    providerTrackId: String(t.id),
  };
}

function unsupported(action: string): never {
  throw new ProviderError({
    kind: "unsupported",
    provider: "deezer",
    message: `Deezer est en lecture seule : ${action} n'est pas possible.`,
  });
}

export function createDeezerProvider(client: DeezerClient = createDeezerClient()): MusicProvider {
  return {
    id: "deezer",

    parsePlaylistUrl: parseDeezerPlaylistUrl,

    async getPlaylist(ref: PlaylistRef): Promise<Playlist> {
      if (ref.provider !== "deezer") {
        throw new Error(`Référence ${ref.provider} passée au provider Deezer`);
      }
      const playlist = await client.get(`/playlist/${ref.id}`, DeezerPlaylistSchema);

      const tracks: Track[] = [];
      let next: string | undefined = `/playlist/${ref.id}/tracks?limit=${PAGE_SIZE}`;
      for (let page = 0; next; page++) {
        if (page >= MAX_PAGES) {
          throw new ProviderError({
            kind: "invalid_response",
            provider: "deezer",
            message: `Pagination interrompue après ${MAX_PAGES} pages`,
          });
        }
        const res: z.infer<typeof DeezerTracksPageSchema> = await client.get(
          next,
          DeezerTracksPageSchema,
        );
        tracks.push(...res.data.map(toTrack));
        next = res.next;
      }

      return {
        ref,
        name: playlist.title,
        description: playlist.description || null,
        tracks,
      };
    },

    async searchTrack() {
      unsupported("chercher un titre pour l'ajouter");
    },

    async createPlaylist() {
      unsupported("créer une playlist");
    },
  };
}

/** Instance partagée : un seul limiteur de débit pour toute l'app (le quota est par IP). */
export const deezerProvider = createDeezerProvider();

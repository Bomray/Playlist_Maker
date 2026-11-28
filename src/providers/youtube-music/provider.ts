// Provider YouTube Music : source en lecture seule, via l'API officielle YouTube Data v3
// et la clé développeur (l'utilisateur n'a besoin d'aucun compte pour une playlist publique).
import type { z } from "zod";
import { ProviderError } from "@/core/errors";
import type { Playlist, PlaylistRef, Track } from "@/core/models";
import type { MusicProvider } from "../types";
import type { YouTubeClient } from "./client";
import {
  PlaylistItemsPageSchema,
  type PlaylistItemSchema,
  PlaylistsResponseSchema,
  VideosResponseSchema,
} from "./schemas";
import { parseYouTubePlaylistUrl, specialListReason } from "./url";
import { isoDurationMs, parseVideoTitle } from "./video-title";

const PAGE_SIZE = "50"; // maximum autorisé par l'API (1 unité de quota par page)
const MAX_PAGES = 100; // garde-fou : 5 000 titres (YouTube plafonne une playlist à 5 000)

type Item = z.infer<typeof PlaylistItemSchema>;

/** Vidéo supprimée ou devenue privée : elle reste dans la playlist mais sans chaîne ni contenu. */
function isUnavailable(item: Item): boolean {
  return !item.snippet.resourceId.videoId || !item.snippet.videoOwnerChannelTitle;
}

function unsupported(action: string): never {
  throw new ProviderError({
    kind: "unsupported",
    provider: "youtube-music",
    message: `YouTube Music est pour l'instant une source en lecture seule : ${action} n'est pas possible.`,
  });
}

export function createYouTubeMusicProvider(client: YouTubeClient): MusicProvider {
  async function readItems(id: string): Promise<Item[]> {
    const items: Item[] = [];
    let pageToken: string | undefined;
    for (let page = 0; page === 0 || pageToken; page++) {
      if (page >= MAX_PAGES) {
        throw new ProviderError({
          kind: "invalid_response",
          provider: "youtube-music",
          message: `Pagination interrompue après ${MAX_PAGES} pages`,
        });
      }
      const params: Record<string, string> = {
        part: "snippet",
        playlistId: id,
        maxResults: PAGE_SIZE,
      };
      if (pageToken) params.pageToken = pageToken;
      const res: z.infer<typeof PlaylistItemsPageSchema> = await client.get(
        "/playlistItems",
        params,
        PlaylistItemsPageSchema,
      );
      items.push(...res.items);
      pageToken = res.nextPageToken;
    }
    return items;
  }

  async function readDurations(videoIds: string[]): Promise<Map<string, number | null>> {
    const durations = new Map<string, number | null>();
    for (let i = 0; i < videoIds.length; i += 50) {
      const ids = videoIds.slice(i, i + 50).join(",");
      const res = await client.get(
        "/videos",
        { part: "contentDetails", id: ids },
        VideosResponseSchema,
      );
      for (const v of res.items) durations.set(v.id, isoDurationMs(v.contentDetails.duration));
    }
    return durations;
  }

  return {
    id: "youtube-music",

    parsePlaylistUrl: parseYouTubePlaylistUrl,

    async getPlaylist(ref: PlaylistRef): Promise<Playlist> {
      if (ref.provider !== "youtube-music") {
        throw new Error(`Référence ${ref.provider} passée au provider YouTube Music`);
      }
      const special = specialListReason(ref.id);
      if (special)
        throw new ProviderError({
          kind: "unsupported",
          provider: "youtube-music",
          message: special,
        });

      const meta = await client.get(
        "/playlists",
        { part: "snippet", id: ref.id },
        PlaylistsResponseSchema,
      );
      // Avec une clé développeur, une playlist privée n'apparaît simplement pas.
      const info = meta.items[0];
      if (!info) {
        throw new ProviderError({
          kind: "not_found",
          provider: "youtube-music",
          message:
            "Playlist YouTube introuvable ou privée : elle doit être publique ou non répertoriée.",
        });
      }

      const items = await readItems(ref.id);
      const available = items.filter((i) => !isUnavailable(i));
      const durations = await readDurations(available.map((i) => i.snippet.resourceId.videoId!));

      const tracks: Track[] = available.map((item) => {
        const videoId = item.snippet.resourceId.videoId!;
        const { title, artists } = parseVideoTitle(
          item.snippet.title,
          item.snippet.videoOwnerChannelTitle,
        );
        return {
          title,
          artists,
          album: null, // l'API ne donne pas l'album
          durationMs: durations.get(videoId) ?? null,
          isrc: null, // ni l'ISRC : le matching se fera par score (titre, artiste, durée)
          provider: "youtube-music",
          providerTrackId: videoId,
          artworkUrl: item.snippet.thumbnails?.medium?.url ?? item.snippet.thumbnails?.default?.url,
        };
      });

      return {
        ref,
        name: info.snippet.title,
        description: info.snippet.description || null,
        tracks,
        unavailableCount: items.length - available.length,
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

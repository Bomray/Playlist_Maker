// Schémas Zod des réponses de l'API Web Spotify utilisées par le provider.
import { z } from "zod";

export const SpotifyTrackSchema = z.object({
  id: z.string().nullable(),
  uri: z.string(),
  name: z.string(),
  duration_ms: z.number(),
  type: z.string().optional(), // "track" ou "episode"
  is_local: z.boolean().optional(),
  artists: z.array(z.object({ name: z.string() })),
  album: z.object({ name: z.string() }).nullish(),
  external_ids: z.object({ isrc: z.string().optional() }).nullish(),
});

export type SpotifyTrack = z.infer<typeof SpotifyTrackSchema>;

export const SearchResponseSchema = z.object({
  tracks: z.object({ items: z.array(SpotifyTrackSchema) }),
});

export const PlaylistResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullish(),
  external_urls: z.object({ spotify: z.string() }),
});

// Depuis février 2026, Spotify renvoie `item` au lieu de `track` dans certaines réponses :
// on accepte les deux (constaté pendant le spike).
export const PlaylistItemsPageSchema = z.object({
  items: z.array(
    z.object({
      track: SpotifyTrackSchema.nullish(),
      item: SpotifyTrackSchema.nullish(),
    }),
  ),
  next: z.string().nullable(),
});

export const SnapshotSchema = z.object({ snapshot_id: z.string() });

// Schémas Zod des réponses de l'API YouTube Data v3 (https://www.googleapis.com/youtube/v3).
import { z } from "zod";

/** Format d'erreur commun aux API Google. */
export const YouTubeErrorSchema = z.object({
  error: z.object({
    code: z.number(),
    message: z.string(),
    errors: z.array(z.object({ reason: z.string().optional() })).optional(),
  }),
});

export const PlaylistsResponseSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      snippet: z.object({ title: z.string(), description: z.string().optional() }),
    }),
  ),
});

export const PlaylistItemSchema = z.object({
  snippet: z.object({
    title: z.string(),
    // Absent pour les vidéos supprimées ou privées.
    videoOwnerChannelTitle: z.string().optional(),
    resourceId: z.object({ videoId: z.string().optional() }),
    thumbnails: z.record(z.string(), z.object({ url: z.string() })).optional(),
  }),
});

export const PlaylistItemsPageSchema = z.object({
  items: z.array(PlaylistItemSchema),
  nextPageToken: z.string().optional(),
});

export const VideosResponseSchema = z.object({
  items: z.array(z.object({ id: z.string(), contentDetails: z.object({ duration: z.string() }) })),
});

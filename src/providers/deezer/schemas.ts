// Schémas Zod des réponses de l'API publique Deezer (https://api.deezer.com).
import { z } from "zod";

/** Particularité Deezer : les erreurs arrivent en HTTP 200 avec un objet `error`. */
export const DeezerErrorSchema = z.object({
  error: z.object({
    type: z.string(),
    message: z.string(),
    code: z.number(),
  }),
});

export type DeezerErrorBody = z.infer<typeof DeezerErrorSchema>["error"];

export const DeezerPlaylistSchema = z.object({
  id: z.number(),
  title: z.string(),
  description: z.string().nullish(),
  nb_tracks: z.number(),
  public: z.boolean().optional(),
});

export const DeezerTrackSchema = z.object({
  id: z.number(),
  title: z.string(),
  duration: z.number(), // en secondes
  isrc: z.string().nullish(),
  readable: z.boolean().optional(),
  artist: z.object({ name: z.string() }),
  album: z.object({ title: z.string() }).nullish(),
});

export const DeezerTracksPageSchema = z.object({
  data: z.array(DeezerTrackSchema),
  total: z.number().optional(),
  next: z.string().optional(),
});

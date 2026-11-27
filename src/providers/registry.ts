// Plateformes disponibles pour une conversion (V1 : Deezer, YouTube Music et Spotify comme
// sources, Spotify comme destination). Seul endroit qui assemble les providers concrets.
import "server-only";
import { serverEnv } from "@/lib/env";
import { deezerProvider } from "./deezer/provider";
import { createSpotifyProvider } from "./spotify/provider";
import { createYouTubeClient } from "./youtube-music/client";
import { createYouTubeMusicProvider } from "./youtube-music/provider";
import type { MusicProvider } from "./types";

export interface ConversionProviders {
  sources: MusicProvider[];
  destination: MusicProvider;
}

export function createConversionProviders(
  getSpotifyToken: () => Promise<string>,
): ConversionProviders {
  const spotify = createSpotifyProvider({ getAccessToken: getSpotifyToken });
  const youtube = createYouTubeMusicProvider(createYouTubeClient(serverEnv().YOUTUBE_API_KEY));
  return { sources: [deezerProvider, youtube, spotify], destination: spotify };
}

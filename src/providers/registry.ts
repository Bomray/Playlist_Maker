// Plateformes disponibles pour une conversion (V1 : Deezer et Spotify comme sources,
// Spotify comme destination). Seul endroit qui assemble les providers concrets.
import "server-only";
import { deezerProvider } from "./deezer/provider";
import { createSpotifyProvider } from "./spotify/provider";
import type { MusicProvider } from "./types";

export interface ConversionProviders {
  sources: MusicProvider[];
  destination: MusicProvider;
}

export function createConversionProviders(
  getSpotifyToken: () => Promise<string>,
): ConversionProviders {
  const spotify = createSpotifyProvider({ getAccessToken: getSpotifyToken });
  return { sources: [deezerProvider, spotify], destination: spotify };
}

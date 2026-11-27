// Test contre la vraie API YouTube. Désactivé par défaut (et donc en CI) :
// `LIVE=1 pnpm test youtube-music.live` (PowerShell : `$env:LIVE=1; pnpm test youtube-music.live`),
// avec YOUTUBE_API_KEY dans l'environnement ou dans .env.local.
import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createYouTubeClient } from "./client";
import { createYouTubeMusicProvider } from "./provider";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

// Playlist de test du développeur (11 titres au 27/11/2026).
const URL = "https://music.youtube.com/playlist?list=PLSOL9LfGEGu0";

describe.skipIf(!process.env.LIVE || !process.env.YOUTUBE_API_KEY)(
  "YouTube Music (API réelle)",
  () => {
    const youtube = createYouTubeMusicProvider(createYouTubeClient(process.env.YOUTUBE_API_KEY));

    it("lit une playlist publique avec artistes et durées", { timeout: 30_000 }, async () => {
      const playlist = await youtube.getPlaylist(youtube.parsePlaylistUrl(URL)!);
      console.log(
        `${playlist.name} : ${playlist.tracks.length} titres, ${playlist.unavailableCount} indisponibles`,
      );
      expect(playlist.tracks.length).toBeGreaterThan(0);
      expect(playlist.tracks.every((t) => t.artists.length > 0 && t.durationMs !== null)).toBe(
        true,
      );
    });
  },
);

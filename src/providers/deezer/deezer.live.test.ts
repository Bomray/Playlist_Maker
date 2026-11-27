// Test contre la vraie API Deezer. Désactivé par défaut (et donc en CI) :
// lancer avec `LIVE=1 pnpm test deezer.live` (PowerShell : `$env:LIVE=1; pnpm test deezer.live`).
import { describe, expect, it } from "vitest";
import { createDeezerProvider } from "./provider";

// Playlist publique trouvée pendant le spike (« French rap », 62 titres au 26/11/2026).
const URL = "https://www.deezer.com/playlist/16006480463";

describe.skipIf(!process.env.LIVE)("Deezer (API réelle)", () => {
  const deezer = createDeezerProvider();

  it("lit une playlist publique avec ses ISRC", { timeout: 30_000 }, async () => {
    const ref = deezer.parsePlaylistUrl(URL);
    expect(ref).not.toBeNull();
    const playlist = await deezer.getPlaylist(ref!);
    expect(playlist.tracks.length).toBeGreaterThan(0);
    const withIsrc = playlist.tracks.filter((t) => t.isrc).length;
    console.log(`${playlist.name} : ${playlist.tracks.length} titres, ${withIsrc} avec ISRC`);
    expect(withIsrc).toBe(playlist.tracks.length);
  });

  it("renvoie not_found pour une playlist inexistante", { timeout: 30_000 }, async () => {
    await expect(deezer.getPlaylist({ provider: "deezer", id: "1" })).rejects.toMatchObject({
      kind: "not_found",
    });
  });
});

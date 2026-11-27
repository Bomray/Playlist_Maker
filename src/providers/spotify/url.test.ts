import { describe, expect, it } from "vitest";
import { parseSpotifyPlaylistUrl } from "./url";

const ID = "2V1Ti24yYnpwKT57BvAKK7";

describe("parseSpotifyPlaylistUrl", () => {
  it.each([
    `https://open.spotify.com/playlist/${ID}`,
    `https://open.spotify.com/playlist/${ID}?si=abc123&pt=xyz`,
    `https://open.spotify.com/intl-fr/playlist/${ID}`,
    `https://open.spotify.com/intl-pt-br/playlist/${ID}/`,
    `open.spotify.com/playlist/${ID}`,
    `spotify:playlist:${ID}`,
    `  https://open.spotify.com/playlist/${ID}  `,
  ])("reconnaît %s", (url) => {
    expect(parseSpotifyPlaylistUrl(url)).toEqual({ provider: "spotify", id: ID });
  });

  it.each([
    `https://open.spotify.com/album/${ID}`,
    "https://open.spotify.com/playlist/trop-court",
    `spotify:playlist:abc`,
    `https://open.spotify.com.evil.com/playlist/${ID}`,
    `https://evil.com/open.spotify.com/playlist/${ID}`,
    "https://www.deezer.com/playlist/16006480463",
    "pas un lien",
    "",
  ])("rejette %s", (url) => {
    expect(parseSpotifyPlaylistUrl(url)).toBeNull();
  });
});

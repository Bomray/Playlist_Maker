import { describe, expect, it } from "vitest";
import { parseDeezerPlaylistUrl } from "./url";

describe("parseDeezerPlaylistUrl", () => {
  it.each([
    "https://www.deezer.com/playlist/16006480463",
    "https://www.deezer.com/fr/playlist/16006480463",
    "https://deezer.com/pt-br/playlist/16006480463/",
    "http://www.deezer.com/playlist/16006480463?utm_source=deezer&deferredFl=1",
    "www.deezer.com/fr/playlist/16006480463",
    "  https://www.deezer.com/playlist/16006480463  ",
  ])("reconnaît %s", (url) => {
    expect(parseDeezerPlaylistUrl(url)).toEqual({ provider: "deezer", id: "16006480463" });
  });

  it.each([
    "https://www.deezer.com/fr/album/302127",
    "https://www.deezer.com/playlist/abc",
    "https://link.deezer.com/s/30ABCdef",
    "https://open.spotify.com/playlist/2V1Ti24yYnpwKT57BvAKK7",
    "https://evil-deezer.com/playlist/123",
    "https://deezer.com.evil.com/playlist/123",
    "pas un lien",
    "",
  ])("rejette %s", (url) => {
    expect(parseDeezerPlaylistUrl(url)).toBeNull();
  });
});

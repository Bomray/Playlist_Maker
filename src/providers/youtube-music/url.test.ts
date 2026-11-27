import { describe, expect, it } from "vitest";
import { parseYouTubePlaylistUrl, specialListReason } from "./url";

describe("parseYouTubePlaylistUrl", () => {
  it.each([
    "https://music.youtube.com/playlist?list=PLSOL9LfGEGu0&si=T1v2HNevrax7yBNf&drli=1",
    "https://www.youtube.com/playlist?list=PLSOL9LfGEGu0",
    "https://m.youtube.com/playlist?list=PLSOL9LfGEGu0",
    "youtube.com/playlist?list=PLSOL9LfGEGu0",
    "https://www.youtube.com/watch?v=1k5QIbweEmU&list=PLSOL9LfGEGu0&index=2",
    "  https://music.youtube.com/playlist?list=PLSOL9LfGEGu0  ",
  ])("reconnaît %s", (url) => {
    expect(parseYouTubePlaylistUrl(url)).toEqual({
      provider: "youtube-music",
      id: "PLSOL9LfGEGu0",
    });
  });

  it.each([
    "https://www.youtube.com/watch?v=1k5QIbweEmU",
    "https://music.youtube.com/browse/MPREb_abc",
    "https://www.youtube.com/playlist",
    "https://www.youtube.com/playlist?list=<script>",
    "https://evil-youtube.com/playlist?list=PL1",
    "https://youtube.com.evil.com/playlist?list=PL1",
    "https://www.deezer.com/playlist/1",
    "pas un lien",
  ])("rejette %s", (url) => {
    expect(parseYouTubePlaylistUrl(url)).toBeNull();
  });
});

describe("specialListReason", () => {
  it("explique les listes que l'API ne lit pas", () => {
    expect(specialListReason("RDCLAK5uy_abc")).toMatch(/Mix/);
    expect(specialListReason("LM")).toMatch(/personnelle/);
    expect(specialListReason("PLSOL9LfGEGu0")).toBeNull();
    expect(specialListReason("OLAK5uy_abc")).toBeNull(); // album : lisible
  });
});

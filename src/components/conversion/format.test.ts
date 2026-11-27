import { describe, expect, it } from "vitest";
import { countLabel, formatDuration, formatScore, providerLabel } from "./format";

describe("format", () => {
  it("durée en m:ss", () => {
    expect(formatDuration(207_000)).toBe("3:27");
    expect(formatDuration(65_400)).toBe("1:05");
    expect(formatDuration(null)).toBe("–");
  });

  it("score en pourcentage arrondi", () => {
    expect(formatScore(0.923)).toBe("92 %");
    expect(formatScore(1)).toBe("100 %");
  });

  it("nom lisible des plateformes", () => {
    expect(providerLabel("youtube-music")).toBe("YouTube Music");
    expect(providerLabel("inconnue")).toBe("inconnue");
  });

  it("accorde le pluriel", () => {
    expect(countLabel(0, "titre")).toBe("0 titre");
    expect(countLabel(1, "titre")).toBe("1 titre");
    expect(countLabel(2, "titre")).toBe("2 titres");
  });
});

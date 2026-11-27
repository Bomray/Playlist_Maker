import { describe, expect, it } from "vitest";
import { decodeEntities, isoDurationMs, parseVideoTitle } from "./video-title";

describe("parseVideoTitle", () => {
  it("chaîne « - Topic » : titre gardé tel quel, artiste = chaîne", () => {
    expect(
      parseVideoTitle("Jamais rentré - Nouvelle École x CUPRA", "Nouvelle École - Topic"),
    ).toEqual({
      title: "Jamais rentré - Nouvelle École x CUPRA",
      artists: ["Nouvelle École"],
    });
    expect(parseVideoTitle("Le goût du sel", "Bigflo & Oli - Topic").artists).toEqual([
      "Bigflo & Oli",
    ]);
  });

  it("clip « Artiste - Titre (Clip officiel) » : coupe au tiret et retire les mentions", () => {
    expect(
      parseVideoTitle("Orelsan - La pluie (feat. Stromae) [Clip Officiel]", "Orelsan"),
    ).toEqual({
      title: "La pluie (feat. Stromae)",
      artists: ["Orelsan"],
    });
    expect(parseVideoTitle("NF - Lie (Official Audio) | 4K", "NFVEVO").title).toBe("Lie");
  });

  it("sans tiret : l'artiste est la chaîne, nettoyée", () => {
    expect(parseVideoTitle("Hide (Official Music Video)", "Juice WRLD Official")).toEqual({
      title: "Hide",
      artists: ["Juice WRLD"],
    });
    expect(parseVideoTitle("Lie (Lyrics)", "NFVEVO").artists).toEqual(["NF"]);
  });

  it("décode les entités HTML", () => {
    expect(parseVideoTitle("Bigflo &amp; Oli - Le goût du sel", "x").artists).toEqual([
      "Bigflo & Oli",
    ]);
    expect(decodeEntities("l&#39;été &quot;chaud&quot;")).toBe('l\'été "chaud"');
  });
});

describe("isoDurationMs", () => {
  it.each([
    ["PT3M30S", 210_000],
    ["PT1H2M3S", 3_723_000],
    ["PT45S", 45_000],
    ["PT4M", 240_000],
  ])("%s → %i ms", (iso, ms) => expect(isoDurationMs(iso)).toBe(ms));

  it.each(["P1D", "PT", "abc"])("%s → null", (iso) => expect(isoDurationMs(iso)).toBeNull());
});

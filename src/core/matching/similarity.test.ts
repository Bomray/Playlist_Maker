import { describe, expect, it } from "vitest";
import { artistSimilarity, durationSimilarity, textSimilarity } from "./similarity";

describe("textSimilarity", () => {
  it("vaut 1 pour des textes identiques et 0 pour des textes vides", () => {
    expect(textSimilarity("hide", "hide")).toBe(1);
    expect(textSimilarity("", "")).toBe(0);
    expect(textSimilarity("a", "abc")).toBe(0);
  });

  it("tolère une faute ou un mot déplacé, pas un titre différent", () => {
    expect(textSimilarity("nekketsu", "nekketsou")).toBeGreaterThanOrEqual(0.75);
    expect(textSimilarity("oli bigflo", "bigflo oli")).toBe(1);
    expect(textSimilarity("le gout du sel", "sous une averse")).toBeLessThan(0.3);
  });
});

describe("artistSimilarity", () => {
  it("compare l'artiste principal sans pénaliser les featurings", () => {
    expect(artistSimilarity("nf", ["nf"], ["nf", "someone"])).toBe(1);
    expect(artistSimilarity("nf", ["nf"], ["nekfeu"])).toBeLessThan(0.5);
  });

  it("accepte un duo écrit autrement grâce aux autres formes", () => {
    const source = ["bigflo and oli", "bigflo", "oli"];
    expect(artistSimilarity("bigflo and oli", source, ["bigflo", "oli"])).toBeGreaterThanOrEqual(
      0.9,
    );
  });

  it("vaut 0 sans artiste", () => {
    expect(artistSimilarity(undefined, [], ["nf"])).toBe(0);
  });
});

describe("durationSimilarity", () => {
  it("1 jusqu'à ±3 s, puis baisse linéaire jusqu'à 0 à 15 s", () => {
    expect(durationSimilarity(200_000, 203_000)).toBe(1);
    expect(durationSimilarity(200_000, 209_000)).toBeCloseTo(0.5);
    expect(durationSimilarity(200_000, 230_000)).toBe(0);
  });

  it("null si une durée manque", () => {
    expect(durationSimilarity(null, 200_000)).toBeNull();
  });
});

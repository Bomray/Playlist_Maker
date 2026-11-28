import { describe, expect, it } from "vitest";
import type { TopEntry } from "./aggregate";
import { normalizeSearch, rankAndSearch } from "./search";

const e = (label: string, sublabel: string | null, plays: number, msPlayed: number): TopEntry => ({
  key: label,
  label,
  sublabel,
  plays,
  msPlayed,
});

const entries = [
  e("Halo", "Beyoncé", 10, 1_000),
  e("Lie", "NF", 30, 500),
  e("Elle pleut", "Nekfeu", 20, 3_000),
];

describe("tops complets", () => {
  it("ignore accents et majuscules", () => {
    expect(normalizeSearch("  BeyOncÉ ")).toBe("beyonce");
  });

  it("classe par écoutes ou par temps", () => {
    expect(rankAndSearch(entries, "plays", "").map((x) => x.label)).toEqual([
      "Lie",
      "Elle pleut",
      "Halo",
    ]);
    expect(rankAndSearch(entries, "msPlayed", "").map((x) => x.label)).toEqual([
      "Elle pleut",
      "Halo",
      "Lie",
    ]);
  });

  it("cherche dans le nom et l'artiste, en gardant le rang complet", () => {
    expect(rankAndSearch(entries, "plays", "beyonce")).toMatchObject([{ label: "Halo", rank: 3 }]);
    expect(rankAndSearch(entries, "plays", "nek pleut").map((x) => x.label)).toEqual([
      "Elle pleut",
    ]);
    expect(rankAndSearch(entries, "plays", "zzz")).toEqual([]);
  });
});

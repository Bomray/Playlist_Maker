import { describe, expect, it } from "vitest";
import { calendar, defaultStep, evolution } from "./evolution";

const day = (key: string, msPlayed: number, plays = 1) => ({ key, msPlayed, plays });

describe("courbe d'évolution", () => {
  it("comble les jours sans écoute par des zéros", () => {
    const points = evolution(
      [day("2025-03-01", 60_000), day("2025-03-03", 120_000)],
      "day",
      "2025-03-01",
      "2025-03-04",
    );
    expect(points.map((p) => [p.key, p.msPlayed])).toEqual([
      ["2025-03-01", 60_000],
      ["2025-03-02", 0],
      ["2025-03-03", 120_000],
      ["2025-03-04", 0],
    ]);
  });

  it("regroupe par semaine (lundi) et par mois", () => {
    const days = [day("2025-03-02", 1), day("2025-03-03", 2), day("2025-03-09", 4)];
    // Le 2 mars 2025 est un dimanche : il appartient à la semaine du lundi 24 février.
    expect(
      evolution(days, "week", "2025-03-02", "2025-03-09").map((p) => [p.key, p.msPlayed]),
    ).toEqual([
      ["2025-02-24", 1],
      ["2025-03-03", 6],
    ]);
    expect(
      evolution(days, "month", "2025-02-15", "2025-03-31").map((p) => [p.key, p.msPlayed]),
    ).toEqual([
      ["2025-02-01", 0],
      ["2025-03-01", 7],
    ]);
  });

  it("ignore ce qui sort de la période et refuse une période vide", () => {
    expect(evolution([day("2024-01-01", 5)], "day", "2025-01-01", "2025-01-01")[0]!.msPlayed).toBe(
      0,
    );
    expect(evolution([], "day", "2025-02-01", "2025-01-01")).toEqual([]);
  });

  it("choisit un pas lisible selon la durée", () => {
    expect(defaultStep("2025-03-01", "2025-03-31")).toBe("day");
    expect(defaultStep("2025-01-01", "2025-12-31")).toBe("week");
    expect(defaultStep("2020-01-01", "2025-12-31")).toBe("month");
  });
});

describe("calendrier jour par jour", () => {
  it("colonnes de semaines, lundi en haut, cases hors période vides", () => {
    // Du mercredi 5 au mardi 11 mars 2025.
    const weeks = calendar([day("2025-03-05", 10)], "2025-03-05", "2025-03-11");
    expect(weeks).toHaveLength(2);
    expect(weeks[0]!.slice(0, 2)).toEqual([null, null]);
    expect(weeks[0]![2]).toMatchObject({ key: "2025-03-05", level: 4 });
    expect(weeks[1]![1]).toMatchObject({ key: "2025-03-11", level: 0 });
    expect(weeks[1]![2]).toBeNull();
  });

  it("niveaux d'intensité relatifs au jour le plus écouté", () => {
    const days = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => day(`2025-03-0${n}`, n * 1000));
    const cells = calendar(days, "2025-03-01", "2025-03-08")
      .flat()
      .filter((c) => c !== null);
    expect(cells.map((c) => c.level)).toEqual([1, 1, 2, 2, 3, 3, 4, 4]);
  });
});

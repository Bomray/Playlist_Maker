import { describe, expect, it } from "vitest";
import { dayKey, parseDayKey, periodBounds, periodLabel, samePeriod } from "./period";

// Jeudi 20 mars 2025, 15 h 30 (heure locale de la machine de test).
const NOW = new Date(2025, 2, 20, 15, 30);
const local = (y: number, m: number, d: number) => new Date(y, m - 1, d).getTime();

describe("bornes des périodes", () => {
  it("tout : aucune borne", () => {
    expect(periodBounds({ kind: "all" }, NOW)).toEqual({});
  });

  it("aujourd'hui et hier couvrent la journée entière", () => {
    expect(periodBounds({ kind: "today" }, NOW)).toEqual({
      from: local(2025, 3, 20),
      to: local(2025, 3, 21) - 1,
    });
    expect(periodBounds({ kind: "yesterday" }, NOW)).toEqual({
      from: local(2025, 3, 19),
      to: local(2025, 3, 20) - 1,
    });
  });

  it("7 jours = aujourd'hui et les 6 jours d'avant", () => {
    expect(periodBounds({ kind: "days", days: 7 }, NOW)).toEqual({
      from: local(2025, 3, 14),
      to: local(2025, 3, 21) - 1,
    });
  });

  it("6 mois glissants se terminent aujourd'hui", () => {
    expect(periodBounds({ kind: "months", months: 6 }, NOW)).toEqual({
      from: local(2024, 9, 21),
      to: local(2025, 3, 21) - 1,
    });
  });

  it("une année précise va du 1er janvier au 31 décembre inclus", () => {
    expect(periodBounds({ kind: "year", year: 2024 }, NOW)).toEqual({
      from: local(2024, 1, 1),
      to: local(2025, 1, 1) - 1,
    });
  });

  it("plage libre : bornes incluses, remises dans l'ordre", () => {
    expect(periodBounds({ kind: "range", from: "2025-02-10", to: "2025-02-01" }, NOW)).toEqual({
      from: local(2025, 2, 1),
      to: local(2025, 2, 11) - 1,
    });
    expect(periodBounds({ kind: "range", from: "n'importe", to: "2025-02-01" }, NOW)).toEqual({});
  });
});

describe("jours au format clé", () => {
  it("aller-retour entre date et clé", () => {
    expect(dayKey(new Date(2025, 0, 5))).toBe("2025-01-05");
    expect(parseDayKey("2025-01-05")?.getTime()).toBe(local(2025, 1, 5));
  });

  it("refuse une date impossible", () => {
    expect(parseDayKey("2025-02-30")).toBeNull();
    expect(parseDayKey("05/01/2025")).toBeNull();
  });
});

describe("libellés", () => {
  it("décrit chaque période", () => {
    expect(periodLabel({ kind: "year", year: 2025 })).toBe("en 2025");
    expect(periodLabel({ kind: "days", days: 30 })).toBe("sur 30 jours");
    expect(periodLabel({ kind: "all" })).toBe("depuis le début");
    expect(periodLabel({ kind: "range", from: "2025-01-01", to: "2025-01-31" })).toMatch(
      /^du 1 janv\. 2025 au 31 janv\. 2025$/,
    );
  });

  it("compare deux périodes", () => {
    expect(samePeriod({ kind: "year", year: 2025 }, { kind: "year", year: 2025 })).toBe(true);
    expect(samePeriod({ kind: "days", days: 7 }, { kind: "days", days: 30 })).toBe(false);
  });
});

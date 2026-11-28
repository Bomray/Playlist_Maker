import { describe, expect, it } from "vitest";
import { durationValue, formatDuration, parseDurationUnit, unitLabel } from "./duration";

// Intl insère une espace insécable fine entre les milliers : on la normalise pour comparer.
const plain = (s: string) => s.replace(/\s/g, " ");

describe("durées", () => {
  it("minutes par défaut, sauf préférence « heures » enregistrée", () => {
    expect(parseDurationUnit(null)).toBe("minutes");
    expect(parseDurationUnit("n'importe")).toBe("minutes");
    expect(parseDurationUnit("hours")).toBe("hours");
  });

  it("formate en minutes ou en heures", () => {
    expect(plain(durationValue(74_040_000, "minutes"))).toBe("1 234");
    expect(durationValue(74_040_000, "hours")).toBe("20,6");
    expect(durationValue(500 * 3_600_000, "hours")).toBe("500");
    expect(formatDuration(2_520_000, "minutes")).toBe("42 min");
    expect(formatDuration(12_600_000, "hours")).toBe("3,5 h");
  });

  it("accorde l'unité", () => {
    expect(unitLabel(60_000, "minutes")).toBe("minute");
    expect(unitLabel(300 * 60_000, "minutes")).toBe("minutes");
    expect(unitLabel(1.5 * 3_600_000, "hours")).toBe("heure");
    expect(unitLabel(5 * 3_600_000, "hours")).toBe("heures");
  });
});

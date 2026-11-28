import { describe, expect, it } from "vitest";
import { formatCountdown, nextCollection } from "./schedule";

const utc = (iso: string) => Date.parse(iso);

describe("prochaine collecte", () => {
  it("minute 17 de l'heure en cours si elle n'est pas passée", () => {
    expect(nextCollection(utc("2025-03-20T10:05:00Z"))).toBe(utc("2025-03-20T10:17:00Z"));
  });

  it("sinon minute 17 de l'heure suivante (y compris pile à l'heure prévue)", () => {
    expect(nextCollection(utc("2025-03-20T10:17:00Z"))).toBe(utc("2025-03-20T11:17:00Z"));
    expect(nextCollection(utc("2025-03-20T23:40:00Z"))).toBe(utc("2025-03-21T00:17:00Z"));
  });
});

describe("compte à rebours", () => {
  it("affiche les secondes sous 10 minutes seulement", () => {
    expect(formatCountdown(42 * 60_000 + 30_000)).toBe("42 min");
    expect(formatCountdown(3 * 60_000 + 5_000)).toBe("3 min 05 s");
    expect(formatCountdown(20_000)).toBe("moins d'une minute");
  });
});

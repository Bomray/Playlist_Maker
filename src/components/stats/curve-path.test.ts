import { describe, expect, it } from "vitest";
import { smoothPath } from "./curve-path";

/** Ordonnées de tous les points du tracé (extrémités et points de contrôle). */
const ys = (d: string) => [...d.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map((m) => Number(m[2]));

describe("courbe lissée", () => {
  it("cas limites", () => {
    expect(smoothPath([])).toBe("");
    expect(smoothPath([{ x: 1, y: 2 }])).toBe("M1,2");
  });

  it("passe par chaque point", () => {
    const d = smoothPath([
      { x: 0, y: 10 },
      { x: 10, y: 0 },
      { x: 20, y: 5 },
    ]);
    expect(d.startsWith("M0,10C")).toBe(true);
    expect(d).toContain(" 10,0C");
    expect(d.endsWith(" 20,5")).toBe(true);
  });

  it("ne dépasse pas les valeurs extrêmes (pas de creux sous zéro)", () => {
    // y = 100 est la ligne de base (zéro écoute) dans un repère SVG.
    const d = smoothPath([
      { x: 0, y: 100 },
      { x: 10, y: 0 },
      { x: 20, y: 100 },
      { x: 30, y: 100 },
    ]);
    expect(Math.max(...ys(d))).toBeLessThanOrEqual(100);
    expect(Math.min(...ys(d))).toBeGreaterThanOrEqual(0);
  });
});

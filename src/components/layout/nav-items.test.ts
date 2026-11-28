import { describe, expect, it } from "vitest";
import { isActive } from "./nav-items";

describe("section active de la navigation", () => {
  it("n'active l'accueil que sur l'accueil", () => {
    expect(isActive("/", "/")).toBe(true);
    expect(isActive("/", "/convertir")).toBe(false);
  });

  it("active une section sur ses sous-pages", () => {
    expect(isActive("/convertir", "/convertir")).toBe(true);
    expect(isActive("/convertir", "/convertir/deezer")).toBe(true);
    expect(isActive("/convertir", "/convertirs")).toBe(false);
  });
});

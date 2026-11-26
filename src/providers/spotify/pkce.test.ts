import { describe, expect, it } from "vitest";
import { codeChallengeS256, createCodeVerifier, createState } from "./pkce";

describe("PKCE", () => {
  it("calcule le challenge du vecteur officiel de la RFC 7636 (annexe B)", () => {
    expect(codeChallengeS256("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe(
      "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
    );
  });

  it("génère un verifier de 64 caractères autorisés, différent à chaque fois", () => {
    const v = createCodeVerifier();
    expect(v).toMatch(/^[A-Za-z0-9\-_]{64}$/);
    expect(createCodeVerifier()).not.toBe(v);
  });

  it("génère un state aléatoire", () => {
    expect(createState()).not.toBe(createState());
  });
});

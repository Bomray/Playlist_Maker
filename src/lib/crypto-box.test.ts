import { describe, expect, it } from "vitest";
import { seal, unseal } from "./crypto-box";

const SECRET = "un-secret-de-test-suffisamment-long-0123456789";

describe("seal / unseal", () => {
  it("retrouve les données d'origine", () => {
    const data = { accessToken: "abc", expiresAt: 123 };
    expect(unseal(seal(data, SECRET), SECRET)).toEqual(data);
  });

  it("produit un résultat différent à chaque appel (IV aléatoire)", () => {
    expect(seal({ a: 1 }, SECRET)).not.toBe(seal({ a: 1 }, SECRET));
  });

  it("rejette un contenu modifié", () => {
    const sealed = seal({ a: 1 }, SECRET);
    const raw = Buffer.from(sealed, "base64url");
    raw[raw.length - 1] = (raw[raw.length - 1] ?? 0) ^ 0xff;
    expect(unseal(raw.toString("base64url"), SECRET)).toBeNull();
  });

  it("rejette un contenu chiffré avec une autre clé", () => {
    const sealed = seal({ a: 1 }, SECRET);
    expect(unseal(sealed, "une-autre-cle-de-test-tout-aussi-longue-000")).toBeNull();
  });

  it("rejette une valeur trop courte ou quelconque", () => {
    expect(unseal("", SECRET)).toBeNull();
    expect(unseal("pas-un-cookie", SECRET)).toBeNull();
  });
});

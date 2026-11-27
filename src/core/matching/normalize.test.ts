import { describe, expect, it } from "vitest";
import { normalizeText, parseTitle, splitArtists } from "./normalize";

describe("normalizeText", () => {
  it("retire accents, ligatures et ponctuation", () => {
    expect(normalizeText("Le cœur des filles")).toBe(normalizeText("Le coeur des filles"));
    expect(normalizeText("  Éléphant, rosé !  ")).toBe("elephant rose");
  });

  it("unifie & / et / and et colle les apostrophes", () => {
    expect(normalizeText("Bigflo & Oli")).toBe("bigflo and oli");
    expect(normalizeText("Bigflo et Oli")).toBe("bigflo and oli");
    expect(normalizeText("Don't Stop")).toBe("dont stop");
    expect(normalizeText("J’ai")).toBe("jai");
  });
});

describe("parseTitle", () => {
  it("sépare les featurings entre parenthèses ou en ligne", () => {
    expect(parseTitle("Hide (feat. Seezyn)")).toEqual({
      base: "hide",
      featured: ["seezyn"],
      version: null,
    });
    expect(parseTitle("Hide ft. Seezyn & Juice WRLD").featured).toEqual(["seezyn", "juice wrld"]);
    expect(parseTitle("Goodbye (with Lil Baby)").featured).toEqual(["lil baby"]);
  });

  it("détecte la version après un tiret ou entre parenthèses", () => {
    expect(parseTitle("Imagine - Remastered 2010")).toMatchObject({
      base: "imagine",
      version: "remaster",
    });
    expect(parseTitle("Creep (Live)")).toMatchObject({ base: "creep", version: "live" });
    expect(parseTitle("Titanium [David Guetta Remix]").version).toBe("remix");
    expect(parseTitle("Lie - Radio Edit").version).toBe("edit");
  });

  it("garde les parenthèses qui font partie du titre", () => {
    expect(parseTitle("My Songs Know What You Did In The Dark (Light Em Up)").base).toBe(
      "my songs know what you did in the dark light em up",
    );
  });

  it("ne confond pas un tiret de titre avec une version", () => {
    expect(parseTitle("Jamais rentré - Nouvelle École x CUPRA")).toMatchObject({
      base: "jamais rentre nouvelle ecole x cupra",
      version: null,
    });
  });
});

describe("splitArtists", () => {
  it("garde la forme entière et les parties d'un duo", () => {
    expect(splitArtists(["Bigflo & Oli"])).toEqual(["bigflo and oli", "bigflo", "oli"]);
  });

  it("découpe virgules et featurings, sans doublons", () => {
    expect(splitArtists(["OZZY, YANAMKO", "Ozzy"])).toEqual(["ozzy yanamko", "ozzy", "yanamko"]);
    expect(splitArtists(["A feat. B"])).toEqual(["a feat b", "a", "b"]);
  });
});

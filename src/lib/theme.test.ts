import { describe, expect, it } from "vitest";
import { nextThemePreference, parseThemePreference, resolveDark } from "./theme";

describe("préférence de thème", () => {
  it("lit une valeur stockée et retombe sur « système » sinon", () => {
    expect(parseThemePreference("dark")).toBe("dark");
    expect(parseThemePreference("light")).toBe("light");
    expect(parseThemePreference(null)).toBe("system");
    expect(parseThemePreference("violet")).toBe("system");
  });

  it("passe de système à sombre puis clair, puis revient au début", () => {
    expect(nextThemePreference("system")).toBe("dark");
    expect(nextThemePreference("dark")).toBe("light");
    expect(nextThemePreference("light")).toBe("system");
  });

  it("suit le système seulement quand la préférence est « système »", () => {
    expect(resolveDark("system", true)).toBe(true);
    expect(resolveDark("system", false)).toBe(false);
    expect(resolveDark("dark", false)).toBe(true);
    expect(resolveDark("light", true)).toBe(false);
  });
});

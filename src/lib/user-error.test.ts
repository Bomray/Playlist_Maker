import { describe, expect, it, vi } from "vitest";
import { ProviderError } from "@/core/errors";
import { httpStatusFor, toUserError } from "./user-error";

describe("toUserError", () => {
  it("garde le type et le message d'une ProviderError, sans le détail brut", () => {
    const e = new ProviderError({
      kind: "rate_limited",
      provider: "spotify",
      message: "HTTP 429",
      detail: "corps brut",
      retryAfterSeconds: 4,
    });
    expect(toUserError(e)).toEqual({
      kind: "rate_limited",
      provider: "spotify",
      message: "HTTP 429",
      retryAfterSeconds: 4,
    });
  });

  it("masque une erreur inattendue et la journalise", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(toUserError(new Error("secret interne"))).toMatchObject({
      kind: "unknown",
      provider: null,
    });
    expect(JSON.stringify(toUserError(new Error("secret interne")))).not.toContain("secret");
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});

describe("httpStatusFor", () => {
  it.each([
    ["unauthorized", 401],
    ["not_accessible", 403],
    ["not_found", 404],
    ["quota", 429],
    ["unsupported", 400],
    ["network", 502],
    ["unknown", 500],
  ] as const)("%s → %i", (kind, status) => expect(httpStatusFor(kind)).toBe(status));
});

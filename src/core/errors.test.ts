import { describe, expect, it } from "vitest";
import { kindFromStatus, ProviderError } from "./errors";

describe("kindFromStatus", () => {
  it.each([
    [401, "unauthorized"],
    [403, "forbidden"],
    [404, "not_found"],
    [429, "rate_limited"],
    [500, "unknown"],
  ] as const)("%i → %s", (status, kind) => {
    expect(kindFromStatus(status)).toBe(kind);
  });
});

describe("ProviderError", () => {
  it("garde le statut et le corps exact", () => {
    const err = new ProviderError({
      kind: "forbidden",
      provider: "spotify",
      message: "Refusé",
      status: 403,
      detail: '{"error":"Forbidden"}',
    });
    expect(err).toBeInstanceOf(Error);
    expect(err.status).toBe(403);
    expect(err.detail).toBe('{"error":"Forbidden"}');
    expect(err.retryAfterSeconds).toBeNull();
  });
});

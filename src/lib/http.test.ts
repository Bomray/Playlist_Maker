import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ProviderError } from "@/core/errors";
import { fetchJson } from "./http";

const Schema = z.object({ id: z.string() });

function mockFetch(response: Response | Error) {
  const fn =
    response instanceof Error
      ? vi.fn().mockRejectedValue(response)
      : vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fn);
  return fn;
}

async function catchError(promise: Promise<unknown>): Promise<ProviderError> {
  try {
    await promise;
  } catch (e) {
    if (e instanceof ProviderError) return e;
    throw e;
  }
  throw new Error("aucune erreur levée");
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchJson", () => {
  it("renvoie les données validées", async () => {
    mockFetch(new Response('{"id":"42"}', { status: 200 }));
    await expect(fetchJson("https://api.test/x", Schema, { provider: "spotify" })).resolves.toEqual(
      { id: "42" },
    );
  });

  it.each([
    [401, "unauthorized"],
    [403, "forbidden"],
    [429, "rate_limited"],
  ] as const)("HTTP %i → %s, avec le corps exact", async (status, kind) => {
    const body = `{"error":{"status":${status},"message":"Nope"}}`;
    mockFetch(new Response(body, { status, headers: { "Retry-After": "7" } }));
    const err = await catchError(fetchJson("https://api.test/x", Schema, { provider: "spotify" }));
    expect(err.kind).toBe(kind);
    expect(err.status).toBe(status);
    expect(err.detail).toBe(body);
    expect(err.retryAfterSeconds).toBe(7);
  });

  it("schéma non respecté → invalid_response", async () => {
    mockFetch(new Response('{"autre":1}', { status: 200 }));
    const err = await catchError(fetchJson("https://api.test/x", Schema, { provider: "deezer" }));
    expect(err.kind).toBe("invalid_response");
    expect(err.detail).toBe('{"autre":1}');
  });

  it("corps non JSON → invalid_response", async () => {
    mockFetch(new Response("<html>", { status: 200 }));
    const err = await catchError(fetchJson("https://api.test/x", Schema, { provider: "deezer" }));
    expect(err.kind).toBe("invalid_response");
  });

  it("pas de réponse → network", async () => {
    mockFetch(new TypeError("fetch failed"));
    const err = await catchError(fetchJson("https://api.test/x", Schema, { provider: "spotify" }));
    expect(err.kind).toBe("network");
  });
});

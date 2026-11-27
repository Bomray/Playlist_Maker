import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ProviderError } from "@/core/errors";
import { createFakeClock } from "@/lib/fake-clock";
import { createRateLimiter } from "@/lib/rate-limit";
import { createDeezerClient, kindFromDeezerError } from "./client";

const Schema = z.object({ id: z.number() });
const quotaBody = { error: { type: "Exception", message: "Quota limit exceeded", code: 4 } };

function setup() {
  const clock = createFakeClock();
  const limiter = createRateLimiter({ limit: 1000, windowMs: 5000, clock });
  return { clock, client: createDeezerClient({ limiter, clock }) };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("kindFromDeezerError", () => {
  it.each([
    [{ type: "Exception", message: "Quota limit exceeded", code: 4 }, "rate_limited"],
    [{ type: "DataException", message: "no data", code: 800 }, "not_found"],
    [{ type: "OAuthException", message: "token", code: 300 }, "not_accessible"],
    [{ type: "Exception", message: "busy", code: 700 }, "unknown"],
  ] as const)("%o → %s", (error, kind) => {
    expect(kindFromDeezerError(error)).toBe(kind);
  });
});

describe("createDeezerClient", () => {
  it("préfixe les chemins avec l'URL de l'API et valide la réponse", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ id: 1 }));
    vi.stubGlobal("fetch", fetchMock);
    const { client } = setup();
    await expect(client.get("/playlist/1", Schema)).resolves.toEqual({ id: 1 });
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.deezer.com/playlist/1");
  });

  it("convertit une erreur en HTTP 200 en ProviderError avec le corps exact", async () => {
    const body = { error: { type: "DataException", message: "no data", code: 800 } };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(body)));
    const { client } = setup();
    const err = await client.get("/playlist/0", Schema).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ProviderError);
    expect(err).toMatchObject({ kind: "not_found", provider: "deezer", status: 200 });
    expect((err as ProviderError).detail).toBe(JSON.stringify(body));
  });

  it("réessaie après un dépassement de quota (attente 1 s puis 2 s)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(quotaBody))
      .mockResolvedValueOnce(json(quotaBody))
      .mockResolvedValue(json({ id: 7 }));
    vi.stubGlobal("fetch", fetchMock);
    const { client, clock } = setup();
    await expect(client.get("/track/7", Schema)).resolves.toEqual({ id: 7 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(clock.sleeps).toEqual([1000, 2000]);
  });

  it("abandonne après 3 nouvelles tentatives", async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(json(quotaBody)));
    vi.stubGlobal("fetch", fetchMock);
    const { client } = setup();
    await expect(client.get("/track/7", Schema)).rejects.toMatchObject({ kind: "rate_limited" });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("ne réessaie pas une erreur qui n'est pas un quota", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({}, 500));
    vi.stubGlobal("fetch", fetchMock);
    const { client } = setup();
    await expect(client.get("/track/7", Schema)).rejects.toMatchObject({ kind: "unknown" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refuse de suivre une URL hors de l'API Deezer", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { client } = setup();
    await expect(client.get("https://evil.example/x", Schema)).rejects.toMatchObject({
      kind: "invalid_response",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

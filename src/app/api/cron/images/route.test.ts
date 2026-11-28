import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({ serverEnv: () => ({ CRON_SECRET: "secret-de-test-0123456789" }) }));
vi.mock("@/lib/db", () => ({ getDb: () => ({}) }));
vi.mock("@/providers/spotify/session", () => ({ spotifyAuthConfig: () => ({}) }));
const fillImages = vi.fn();
vi.mock("@/providers/spotify/images", () => ({ fillImages }));

const { POST } = await import("./route");

const call = (auth?: string) =>
  POST(
    new Request("http://x/api/cron/images", {
      method: "POST",
      headers: auth ? { authorization: auth } : {},
    }),
  );

afterEach(() => vi.clearAllMocks());

describe("POST /api/cron/images", () => {
  it("refuse sans le bon secret", async () => {
    expect((await call("Bearer mauvais")).status).toBe(401);
    expect(fillImages).not.toHaveBeenCalled();
  });

  it("avec le secret : remplit et renvoie les compteurs", async () => {
    fillImages.mockResolvedValue({ tracks: 120, artists: 30, rateLimited: false, failed: false });
    const res = await call("Bearer secret-de-test-0123456789");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      tracks: 120,
      artists: 30,
      rateLimited: false,
      failed: false,
    });
  });
});

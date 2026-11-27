import { afterEach, describe, expect, it, vi } from "vitest";

const env = { CRON_SECRET: "secret-de-test-suffisamment-long-0123456789" as string | undefined };
vi.mock("@/lib/env", () => ({ serverEnv: () => env }));
vi.mock("@/providers/spotify/session", () => ({ accountDeps: () => ({}) }));
const collectAll = vi.fn();
vi.mock("@/providers/spotify/collector", () => ({ collectAll }));

const { POST } = await import("./route");

const call = (auth?: string) =>
  POST(
    new Request("http://x/api/cron/collect", {
      method: "POST",
      headers: auth ? { authorization: auth } : {},
    }),
  );

afterEach(() => vi.clearAllMocks());

describe("POST /api/cron/collect", () => {
  it("refuse sans le bon secret, sans lancer la collecte", async () => {
    expect((await call()).status).toBe(401);
    expect((await call("Bearer mauvais")).status).toBe(401);
    expect((await call(`Basic ${env.CRON_SECRET}`)).status).toBe(401);
    expect(collectAll).not.toHaveBeenCalled();
  });

  it("CRON_SECRET non configuré : 503", async () => {
    const saved = env.CRON_SECRET;
    env.CRON_SECRET = undefined;
    expect((await call("Bearer x")).status).toBe(503);
    env.CRON_SECRET = saved;
  });

  it("avec le secret : collecte et renvoie seulement des compteurs", async () => {
    collectAll.mockResolvedValue([
      { userId: "u1", fetched: 3, inserted: 2, error: null },
      { userId: "u2", fetched: 0, inserted: 0, error: "Accès expiré" },
    ]);
    const res = await call(`Bearer ${env.CRON_SECRET}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ users: 2, fetched: 3, inserted: 2, errors: 1 });
    expect(JSON.stringify(body)).not.toContain("u1");
  });
});

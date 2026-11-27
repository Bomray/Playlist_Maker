import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProviderError } from "@/core/errors";
import { createTestDb } from "@/lib/db/test-db";
import { upsertUser } from "@/lib/db/users";
import { readNdjson } from "@/lib/ndjson";
import { encodePlay, type HistoryEvent, parseHistoryEvent } from "@/lib/stats-sync";

// Vraie base PGlite derrière les routes ; seule la session est simulée.
let db: Awaited<ReturnType<typeof createTestDb>>;
const requireUserId = vi.fn<() => Promise<string>>();
vi.mock("@/lib/db", () => ({ getDb: () => db }));
vi.mock("@/providers/spotify/session", () => ({ requireUserId }));

const importRoute = await import("../import/route");
const historyRoute = await import("./route");

let userId: string;
beforeEach(async () => {
  db = await createTestDb();
  const u = await upsertUser(db, {
    spotifyUserId: "sp1",
    displayName: null,
    tokens: { accessTokenEnc: "a", refreshTokenEnc: "r", expiresAt: new Date(), scope: "" },
  });
  userId = u.id;
  requireUserId.mockResolvedValue(userId);
});
afterEach(async () => {
  vi.clearAllMocks();
  await db.close();
});

const wire = (n: number, title = "Lie") =>
  encodePlay({
    endedAt: Date.parse("2024-01-01T00:00:00Z") + n * 60_000,
    msPlayed: 180_000,
    kind: "music",
    title,
    artist: "NF",
    album: null,
    uri: `spotify:track:${title}`,
    skipped: false,
    offlineTs: 0,
  });

function importRequest(body: unknown, contentType = "application/json") {
  return importRoute.POST(
    new Request("http://x/api/stats/import", {
      method: "POST",
      headers: { "content-type": contentType },
      body: JSON.stringify(body),
    }),
  );
}

async function history(): Promise<HistoryEvent[]> {
  const res = await historyRoute.GET(new Request("http://x/api/stats/history"));
  const out: HistoryEvent[] = [];
  for await (const e of readNdjson(res.body!, parseHistoryEvent)) out.push(e);
  return out;
}

describe("POST /api/stats/import", () => {
  it("enregistre un lot et ignore les doublons au réimport", async () => {
    const batch = { plays: [wire(1), wire(2), wire(3, "B")] };
    expect(await (await importRequest(batch)).json()).toEqual({ received: 3, inserted: 3 });
    expect(await (await importRequest(batch)).json()).toEqual({ received: 3, inserted: 0 });
  });

  it("refuse sans connexion, sans JSON ou avec un lot invalide", async () => {
    requireUserId.mockRejectedValueOnce(
      new ProviderError({ kind: "unauthorized", provider: "spotify", message: "Connecte-toi" }),
    );
    expect((await importRequest({ plays: [wire(1)] })).status).toBe(401);
    expect((await importRequest({ plays: [wire(1)] }, "text/plain")).status).toBe(415);
    expect((await importRequest({ plays: [] })).status).toBe(400);
  });
});

describe("GET puis DELETE /api/stats/history", () => {
  it("renvoie résumé, morceaux et écoutes, puis supprime tout", async () => {
    await importRequest({ plays: [wire(1), wire(2), wire(3, "B")] });
    const events = await history();
    expect(events[0]).toEqual({ type: "summary", plays: 3 });
    const tracks = events.find((e) => e.type === "tracks");
    expect(tracks?.type === "tracks" && tracks.tracks.map((t) => t[1]).sort()).toEqual([
      "B",
      "Lie",
    ]);
    const rows = events.flatMap((e) => (e.type === "plays" ? e.rows : []));
    expect(rows).toHaveLength(3);
    expect(events.at(-1)).toEqual({ type: "end" });

    const res = await historyRoute.DELETE();
    expect(await res.json()).toEqual({ deleted: 3 });
    expect(await history()).toEqual([{ type: "summary", plays: 0 }, { type: "end" }]);
  });

  it("non connecté : 401 JSON, sans flux", async () => {
    requireUserId.mockRejectedValue(
      new ProviderError({ kind: "unauthorized", provider: "spotify", message: "Connecte-toi" }),
    );
    const res = await historyRoute.GET(new Request("http://x/api/stats/history"));
    expect(res.status).toBe(401);
    expect((await historyRoute.DELETE()).status).toBe(401);
  });
});

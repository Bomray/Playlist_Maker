import { describe, expect, it, vi } from "vitest";
import type { Play } from "@/core/stats";
import { ndjsonLine } from "@/lib/ndjson";
import type { HistoryEvent } from "@/lib/stats-sync";
import { downloadHistory, SyncError, uploadPlays } from "./account-sync";

function ndjson(events: HistoryEvent[], status = 200) {
  return new Response(events.map(ndjsonLine).join(""), { status });
}

const play = (n: number): Play => ({
  endedAt: Date.parse("2024-01-01T00:00:00Z") + n * 60_000,
  msPlayed: 180_000,
  kind: "music",
  title: `T${n}`,
  artist: "A",
  album: null,
  uri: `spotify:track:t${n}`,
  skipped: null,
  offlineTs: 0,
});

describe("downloadHistory", () => {
  it("reconstruit l'historique page par page, avec progression", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      ndjson([
        { type: "summary", plays: 3 },
        {
          type: "tracks",
          tracks: [
            [1, "Lie", "NF", "Perception", "spotify:track:lie", "music"],
            [2, "Ép. 1", "Pod", null, null, "podcast"],
          ],
        },
        {
          type: "plays",
          rows: [
            [1, 1000, 180_000, false, 0],
            [2, 2000, 60_000, null, 0],
          ],
        },
        { type: "plays", rows: [[1, 3000, 5_000, true, 0]] },
        { type: "end" },
      ]),
    );
    const onProgress = vi.fn();
    const plays = await downloadHistory(onProgress, fetchImpl);
    expect(plays.map((p) => [p.title, p.endedAt, p.kind])).toEqual([
      ["Lie", 1000, "music"],
      ["Ép. 1", 2000, "podcast"],
      ["Lie", 3000, "music"],
    ]);
    expect(onProgress.mock.calls).toEqual([
      [2, 3],
      [3, 3],
    ]);
  });

  it("flux coupé avant la fin : erreur plutôt que des stats partielles", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      ndjson([
        { type: "summary", plays: 10 },
        { type: "tracks", tracks: [] },
      ]),
    );
    await expect(downloadHistory(() => {}, fetchImpl)).rejects.toThrow(/interrompu/);
  });

  it("non connecté (401) ou erreur dans le flux : SyncError", async () => {
    const unauthorized = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json(
          { error: { kind: "unauthorized", message: "Connecte-toi" } },
          { status: 401 },
        ),
      );
    await expect(downloadHistory(() => {}, unauthorized)).rejects.toMatchObject({
      message: "Connecte-toi",
      unauthorized: true,
    });
    const failing = vi.fn<typeof fetch>().mockResolvedValue(
      ndjson([
        {
          type: "error",
          error: {
            kind: "network",
            provider: null,
            message: "Base injoignable",
            retryAfterSeconds: null,
          },
        },
      ]),
    );
    await expect(downloadHistory(() => {}, failing)).rejects.toBeInstanceOf(SyncError);
  });
});

describe("uploadPlays", () => {
  it("envoie par lots de 5 000 et additionne les écoutes ajoutées", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (_url, init) => {
      const { plays } = JSON.parse(init!.body as string) as { plays: unknown[] };
      return Response.json({ received: plays.length, inserted: plays.length - 1 });
    });
    const onProgress = vi.fn();
    const plays = Array.from({ length: 12_000 }, (_, i) => play(i));
    expect(await uploadPlays(plays, onProgress, fetchImpl)).toEqual({
      received: 12_000,
      inserted: 11_997,
    });
    const sizes = fetchImpl.mock.calls.map(
      ([, init]) => (JSON.parse(init!.body as string) as { plays: unknown[] }).plays.length,
    );
    expect(sizes).toEqual([5000, 5000, 2000]);
    expect(onProgress.mock.calls.at(-1)).toEqual([12_000, 12_000, 11_997]);
    expect(fetchImpl.mock.calls[0]![1]).toMatchObject({
      method: "POST",
      headers: { "content-type": "application/json" },
    });
  });

  it("s'arrête au premier lot refusé", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ error: "Lot d'écoutes invalide" }, { status: 400 }));
    await expect(uploadPlays([play(1), play(2)], () => {}, fetchImpl)).rejects.toMatchObject({
      message: "Lot d'écoutes invalide",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

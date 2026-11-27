import { describe, expect, it } from "vitest";
import { type ConversionEvent, encodeEvent, readConversionEvents } from "./conversion-stream";

/** Flux qui livre le texte en morceaux de `size` octets (coupe lignes et caractères UTF-8). */
function chunked(text: string, size: number): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(text);
  let i = 0;
  return new ReadableStream({
    pull(controller) {
      if (i >= bytes.length) return controller.close();
      controller.enqueue(bytes.slice(i, i + size));
      i += size;
    },
  });
}

async function collect(stream: ReadableStream<Uint8Array>) {
  const events: ConversionEvent[] = [];
  for await (const e of readConversionEvents(stream)) events.push(e);
  return events;
}

const events: ConversionEvent[] = [
  { type: "playlist", name: "Rap français — été", source: "deezer", total: 2 },
  { type: "progress", done: 1, total: 2 },
  {
    type: "error",
    error: {
      kind: "rate_limited",
      provider: "spotify",
      message: "Trop de requêtes",
      retryAfterSeconds: 5,
    },
  },
];

describe("readConversionEvents", () => {
  it.each([1, 3, 7, 1000])("relit les événements, morceaux de %i octet(s)", async (size) => {
    const text = events.map(encodeEvent).join("");
    expect(await collect(chunked(text, size))).toEqual(events);
  });

  it("accepte une dernière ligne sans retour à la ligne et ignore les lignes vides", async () => {
    const text = `\n${encodeEvent(events[1]!)}\n${JSON.stringify(events[0])}`;
    expect(await collect(chunked(text, 5))).toEqual([events[1], events[0]]);
  });

  it("rejette un événement inconnu", async () => {
    await expect(collect(chunked('{"type":"autre"}\n', 100))).rejects.toThrow();
  });
});

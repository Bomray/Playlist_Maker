// Lecture d'un flux NDJSON (une valeur JSON par ligne), au fur et à mesure qu'il arrive.

/** Lit les lignes JSON d'un flux ; `parse` valide chaque valeur (ex. schéma Zod). */
export async function* readNdjson<T>(
  body: ReadableStream<Uint8Array>,
  parse: (value: unknown) => T,
): AsyncGenerator<T> {
  const reader = body.getReader();
  // `stream: true` : un caractère UTF-8 peut être coupé entre deux morceaux reçus.
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    buffer += value ? decoder.decode(value, { stream: true }) : decoder.decode();
    // Un morceau reçu peut contenir plusieurs lignes, ou une ligne coupée en deux.
    let newline: number;
    while ((newline = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line) yield parse(JSON.parse(line));
    }
    if (done) break;
  }
  if (buffer.trim()) yield parse(JSON.parse(buffer));
}

export const NDJSON_CONTENT_TYPE = "application/x-ndjson; charset=utf-8";

export function ndjsonLine(value: unknown): string {
  return `${JSON.stringify(value)}\n`;
}

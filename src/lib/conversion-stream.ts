// Protocole du flux de conversion (POST /api/convert) : une ligne JSON par événement
// (NDJSON). Partagé entre le Route Handler (écriture) et le navigateur (lecture).
import { z } from "zod";
import type { ConversionReport } from "@/core/convert";
import { ndjsonLine, readNdjson } from "./ndjson";
import type { UserError } from "./user-error";

export type ConversionEvent =
  /** Playlist source lue : on connaît son nom et son nombre de titres. */
  | { type: "playlist"; name: string; source: string; total: number }
  /** Titre traité. */
  | { type: "progress"; done: number; total: number }
  /** Fin : rapport complet, prêt pour le récapitulatif. */
  | { type: "done"; report: ConversionReport }
  /** Échec : la conversion s'arrête. */
  | { type: "error"; error: UserError };

// Le flux vient de notre propre serveur : on vérifie la forme de l'enveloppe sans
// re-valider tout le rapport, déjà construit par `core/convert`.
const EventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("playlist"),
    name: z.string(),
    source: z.string(),
    total: z.number(),
  }),
  z.object({ type: z.literal("progress"), done: z.number(), total: z.number() }),
  z.object({
    type: z.literal("done"),
    report: z.custom<ConversionReport>((v) => typeof v === "object" && v !== null),
  }),
  z.object({
    type: z.literal("error"),
    error: z.object({
      kind: z.string(),
      provider: z.string().nullable(),
      message: z.string(),
      retryAfterSeconds: z.number().nullable(),
    }),
  }),
]);

export { NDJSON_CONTENT_TYPE } from "./ndjson";

export function encodeEvent(event: ConversionEvent): string {
  return ndjsonLine(event);
}

/** Lit un flux NDJSON et renvoie les événements au fur et à mesure qu'ils arrivent. */
export function readConversionEvents(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<ConversionEvent> {
  return readNdjson(body, (v) => EventSchema.parse(v) as ConversionEvent);
}

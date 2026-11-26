// Utilitaires partagés par les spikes. Code jetable, hors application.
import { writeFileSync } from "node:fs";
import { z } from "zod";

/** Format commun affiché par chaque script de spike. */
export interface SpikeTrack {
  title: string;
  artists: string[];
  album: string | null;
  durationMs: number | null;
  isrc: string | null;
  platformId: string;
}

export interface SpikeResult {
  platform: string;
  url: string;
  playlist: { id: string; name: string | null; trackCount: number | null };
  tracks: SpikeTrack[];
  notes: string[];
}

/** Erreur HTTP avec le statut et le corps exact renvoyés par l'API. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly url: string,
    public readonly body: string,
  ) {
    super(`HTTP ${status} sur ${url} : ${body.slice(0, 500)}`);
  }
}

/** GET (ou autre) + parse JSON + validation Zod. Lève HttpError si statut non 2xx. */
export async function fetchJson<T>(
  url: string,
  schema: z.ZodType<T>,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(url, init);
  const text = await res.text();
  if (!res.ok) throw new HttpError(res.status, url, text);
  return schema.parse(JSON.parse(text));
}

export function requireArg(usage: string): string {
  const arg = process.argv[2];
  if (!arg) {
    console.error(`Usage : ${usage}`);
    process.exit(1);
  }
  return arg;
}

/** Affiche le résultat en JSON et l'enregistre dans output/<fichier>. */
export function output(result: SpikeResult, file: string): void {
  const json = JSON.stringify(result, null, 2);
  writeFileSync(new URL(`./output/${file}`, import.meta.url), json + "\n");
  console.log(json);
}

/** Affiche une erreur de façon lisible et termine avec un code non nul. */
export function fail(err: unknown): never {
  if (err instanceof HttpError) {
    console.error(`ÉCHEC — HTTP ${err.status}\nURL : ${err.url}\nCorps : ${err.body}`);
  } else {
    console.error("ÉCHEC —", err);
  }
  process.exit(1);
}

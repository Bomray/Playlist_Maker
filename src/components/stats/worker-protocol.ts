// Messages échangés entre la page de stats et son Web Worker.
import type { Stats } from "@/core/stats";

export type WorkerRequest =
  | { type: "load"; files: File[] }
  | { type: "compute"; from?: number; to?: number; timeZone: string };

export type WorkerResponse =
  | { type: "progress"; done: number; total: number }
  | { type: "loaded"; plays: number; historyFiles: number; skippedEntries: number; years: number[] }
  | { type: "stats"; stats: Stats }
  | { type: "error"; message: string };

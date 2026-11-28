// Messages échangés entre la page de stats et son Web Worker.
import type { Selection, Stats } from "@/core/stats";

/** « main » : stats de la page ; « detail » : page d'un artiste, d'un album ou d'un titre. */
export type StatsTarget = "main" | "detail";

export type DataSource = "file" | "account";

export type WorkerRequest =
  /** Lire un export déposé (fichiers .zip ou .json). */
  | { type: "load"; files: File[] }
  /** Télécharger l'historique enregistré dans le compte. */
  | { type: "loadAccount" }
  /** Enregistrer dans le compte les écoutes actuellement chargées (export déposé). */
  | { type: "upload" }
  | {
      type: "compute";
      target: StatsTarget;
      from?: number;
      to?: number;
      timeZone: string;
      selection?: Selection;
    };

export type WorkerResponse =
  | { type: "progress"; done: number; total: number }
  | {
      type: "loaded";
      source: DataSource;
      plays: number;
      historyFiles: number;
      skippedEntries: number;
      years: number[];
    }
  /** Le compte n'a encore aucun historique enregistré. */
  | { type: "accountEmpty" }
  | { type: "uploadProgress"; sent: number; total: number; inserted: number }
  | { type: "uploaded"; received: number; inserted: number }
  | { type: "stats"; target: StatsTarget; stats: Stats }
  | { type: "error"; message: string; during: "load" | "upload"; unauthorized: boolean };

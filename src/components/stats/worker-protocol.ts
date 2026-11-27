// Messages échangés entre la page de stats et son Web Worker.
import type { Stats } from "@/core/stats";

export type DataSource = "file" | "account";

export type WorkerRequest =
  /** Lire un export déposé (fichiers .zip ou .json). */
  | { type: "load"; files: File[] }
  /** Télécharger l'historique enregistré dans le compte. */
  | { type: "loadAccount" }
  /** Enregistrer dans le compte les écoutes actuellement chargées (export déposé). */
  | { type: "upload" }
  | { type: "compute"; from?: number; to?: number; timeZone: string };

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
  | { type: "stats"; stats: Stats }
  | { type: "error"; message: string; during: "load" | "upload"; unauthorized: boolean };

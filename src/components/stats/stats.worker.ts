// Web Worker : lit l'export (ou télécharge l'historique enregistré) et calcule les stats hors
// du fil principal, pour que la page reste fluide (~300 000 lectures pour un gros historique).
// Les lectures restent en mémoire ici : changer de période ne relit rien.
import { computeStats, type Play } from "@/core/stats";
import { downloadHistory, SyncError, uploadPlays } from "./account-sync";
import { ExportReadError, readExport } from "./read-export";
import type { DataSource, WorkerRequest, WorkerResponse } from "./worker-protocol";

let plays: Play[] = [];

function reply(message: WorkerResponse): void {
  postMessage(message);
}

function loaded(source: DataSource, historyFiles: number, skippedEntries: number): void {
  const years = [...new Set(plays.map((p) => new Date(p.endedAt).getFullYear()))].sort(
    (a, b) => a - b,
  );
  reply({ type: "loaded", source, plays: plays.length, historyFiles, skippedEntries, years });
}

async function loadFiles(files: File[]): Promise<void> {
  const inputs = await Promise.all(
    files.map(async (f) => ({ name: f.name, data: new Uint8Array(await f.arrayBuffer()) })),
  );
  const result = readExport(inputs, (done, total) => reply({ type: "progress", done, total }));
  plays = result.plays;
  loaded("file", result.historyFiles, result.skippedEntries);
}

async function loadAccount(): Promise<void> {
  plays = await downloadHistory((done, total) => reply({ type: "progress", done, total }));
  if (plays.length === 0) reply({ type: "accountEmpty" });
  else loaded("account", 0, 0);
}

async function upload(): Promise<void> {
  const result = await uploadPlays(plays, (sent, total, inserted) =>
    reply({ type: "uploadProgress", sent, total, inserted }),
  );
  reply({ type: "uploaded", ...result });
}

function errorMessage(e: unknown, during: "load" | "upload"): WorkerResponse {
  if (e instanceof ExportReadError || e instanceof SyncError) {
    return {
      type: "error",
      message: e.message,
      during,
      unauthorized: e instanceof SyncError && e.unauthorized,
    };
  }
  console.error("Erreur dans le worker de stats", e);
  const message =
    during === "upload"
      ? "L'enregistrement a été interrompu (connexion perdue ?). Réessaie : les écoutes déjà envoyées ne seront pas dupliquées."
      : "Erreur inattendue pendant la lecture des écoutes.";
  return { type: "error", message, during, unauthorized: false };
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data;
  const during = msg.type === "upload" ? "upload" : "load";
  try {
    if (msg.type === "load") await loadFiles(msg.files);
    else if (msg.type === "loadAccount") await loadAccount();
    else if (msg.type === "upload") await upload();
    else reply({ type: "stats", target: msg.target, stats: computeStats(plays, msg) });
  } catch (e) {
    reply(errorMessage(e, during));
  }
};

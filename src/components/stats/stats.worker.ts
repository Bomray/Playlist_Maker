// Web Worker : lit l'export et calcule les stats hors du fil principal, pour que la page
// reste fluide pendant le traitement (~220 Mo et ~300 000 lectures pour un export étendu).
// Les lectures restent en mémoire ici : changer de période ne relit pas les fichiers.
import { computeStats, type Play } from "@/core/stats";
import { ExportReadError, readExport } from "./read-export";
import type { WorkerRequest, WorkerResponse } from "./worker-protocol";

let plays: Play[] = [];

function reply(message: WorkerResponse): void {
  postMessage(message);
}

async function load(files: File[]): Promise<void> {
  const inputs = await Promise.all(
    files.map(async (f) => ({ name: f.name, data: new Uint8Array(await f.arrayBuffer()) })),
  );
  const result = readExport(inputs, (done, total) => reply({ type: "progress", done, total }));
  plays = result.plays;
  const years = [...new Set(plays.map((p) => new Date(p.endedAt).getFullYear()))].sort(
    (a, b) => a - b,
  );
  reply({
    type: "loaded",
    plays: plays.length,
    historyFiles: result.historyFiles,
    skippedEntries: result.skippedEntries,
    years,
  });
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data;
  try {
    if (msg.type === "load") await load(msg.files);
    else reply({ type: "stats", stats: computeStats(plays, msg) });
  } catch (e) {
    if (!(e instanceof ExportReadError)) console.error("Erreur dans le worker de stats", e);
    reply({
      type: "error",
      message:
        e instanceof ExportReadError
          ? e.message
          : "Erreur inattendue pendant la lecture de l'export.",
    });
  }
};

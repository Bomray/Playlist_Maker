// Lecture des fichiers déposés (archive .zip de Spotify ou fichiers .json), côté navigateur.
// Utilisé par le Web Worker ; aucune donnée ne quitte l'appareil.
import { strFromU8, unzipSync } from "fflate";
import { isHistoryFileName, parseExportFile, type Play } from "@/core/stats";

export interface InputFile {
  name: string;
  data: Uint8Array;
}

export interface ReadResult {
  plays: Play[];
  /** Fichiers d'historique lus (dans l'archive ou déposés directement). */
  historyFiles: number;
  skippedEntries: number;
}

export class ExportReadError extends Error {}

function isZip(file: InputFile): boolean {
  // Signature « PK\x03\x04 » au début des archives zip.
  const d = file.data;
  return d[0] === 0x50 && d[1] === 0x4b && d[2] === 0x03 && d[3] === 0x04;
}

/** Fichiers d'historique contenus dans les fichiers déposés (archives développées). */
export function historyEntries(files: readonly InputFile[]): InputFile[] {
  const out: InputFile[] = [];
  for (const file of files) {
    if (isZip(file)) {
      let entries: Record<string, Uint8Array>;
      try {
        // `filter` : seuls les fichiers d'historique sont décompressés (pas les PDF, etc.).
        entries = unzipSync(file.data, { filter: (f) => isHistoryFileName(f.name) });
      } catch (cause) {
        throw new ExportReadError(`Archive illisible : ${file.name}`, { cause });
      }
      for (const [name, data] of Object.entries(entries)) out.push({ name, data });
    } else if (isHistoryFileName(file.name)) {
      out.push(file);
    }
  }
  return out;
}

/**
 * Lit tous les fichiers d'historique. `onProgress(fait, total)` est appelé après chaque
 * fichier pour afficher l'avancement (un export étendu fait ~20 fichiers de 12 Mo).
 */
export function readExport(
  files: readonly InputFile[],
  onProgress?: (done: number, total: number) => void,
): ReadResult {
  const history = historyEntries(files);
  if (history.length === 0) {
    throw new ExportReadError(
      "Aucun historique d'écoute trouvé. Dépose l'archive reçue de Spotify (my_spotify_data.zip) ou ses fichiers Streaming_History_*.json.",
    );
  }
  const plays: Play[] = [];
  let skippedEntries = 0;
  history.forEach((file, i) => {
    let json: unknown;
    try {
      json = JSON.parse(strFromU8(file.data));
    } catch (cause) {
      throw new ExportReadError(`Fichier JSON invalide : ${file.name}`, { cause });
    }
    const result = parseExportFile(json);
    // Boucle plutôt que `push(...result.plays)` : un fichier peut dépasser la limite d'arguments.
    for (const p of result.plays) plays.push(p);
    skippedEntries += result.skippedEntries;
    onProgress?.(i + 1, history.length);
  });
  return { plays, historyFiles: history.length, skippedEntries };
}

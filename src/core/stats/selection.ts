// Sélection d'un artiste, d'un album ou d'un titre (pages de détail), et son adresse.
// Les pages de détail restent sur « / » (paramètres d'URL) : les écoutes déjà chargées dans
// le navigateur servent sans rien relire.
import type { Play } from "./parse";

export type Selection =
  | { kind: "artist"; artist: string }
  | { kind: "album"; artist: string; album: string }
  /** `uri` quand il est connu, sinon artiste + titre (exports sans URI). */
  | { kind: "track"; artist: string; title: string; uri: string | null };

export function matchesSelection(p: Play, s: Selection): boolean {
  if (p.kind !== "music" || p.artist !== s.artist) return false;
  if (s.kind === "artist") return true;
  if (s.kind === "album") return p.album === s.album;
  return s.uri ? p.uri === s.uri : p.title === s.title;
}

export function selectionToParams(s: Selection): URLSearchParams {
  if (s.kind === "artist") return new URLSearchParams({ artiste: s.artist });
  if (s.kind === "album") return new URLSearchParams({ album: s.album, de: s.artist });
  const params = new URLSearchParams({ titre: s.title, de: s.artist });
  if (s.uri) params.set("uri", s.uri);
  return params;
}

export function selectionFromParams(params: URLSearchParams): Selection | null {
  const artist = params.get("artiste");
  if (artist) return { kind: "artist", artist };
  const by = params.get("de");
  if (!by) return null;
  const album = params.get("album");
  if (album) return { kind: "album", artist: by, album };
  const title = params.get("titre");
  if (title) return { kind: "track", artist: by, title, uri: params.get("uri") };
  return null;
}

/** Clé de l'entrée correspondante dans les tops (`TopEntry.key`). */
export function selectionKey(s: Selection): string {
  if (s.kind === "artist") return s.artist;
  if (s.kind === "album") return `${s.artist}\u0000${s.album}`;
  return s.uri ?? `${s.artist}\u0000${s.title}`;
}

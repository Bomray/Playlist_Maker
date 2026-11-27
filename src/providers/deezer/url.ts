import type { PlaylistRef } from "@/core/models";

const HOST = /^(www\.)?deezer\.com$/i;
// /playlist/123 ou /fr/playlist/123 (code langue facultatif, ex. "fr", "pt-br").
const PATH = /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?playlist\/(\d+)\/?$/i;

/**
 * Extrait l'id d'un lien de playlist Deezer, ou renvoie `null`.
 * Les liens courts (`link.deezer.com/s/…`) ne sont pas reconnus : il faudrait
 * suivre la redirection, donc faire un appel réseau.
 */
export function parseDeezerPlaylistUrl(input: string): PlaylistRef | null {
  const trimmed = input.trim();
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    // Texte qui n'est pas une URL : pas un lien Deezer.
    return null;
  }
  if (!HOST.test(url.hostname)) return null;
  const id = PATH.exec(url.pathname)?.[1];
  return id ? { provider: "deezer", id } : null;
}

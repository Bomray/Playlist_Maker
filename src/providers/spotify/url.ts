import type { PlaylistRef } from "@/core/models";

const ID = /^[A-Za-z0-9]{22}$/;
// /playlist/{id} ou /intl-fr/playlist/{id} (préfixe de langue ajouté par le site).
const PATH = /^\/(?:intl-[a-z]{2}(?:-[a-z]{2})?\/)?playlist\/([A-Za-z0-9]{22})\/?$/i;

/** Extrait l'id d'un lien (ou d'une URI `spotify:playlist:…`) de playlist Spotify, ou renvoie `null`. */
export function parseSpotifyPlaylistUrl(input: string): PlaylistRef | null {
  const trimmed = input.trim();

  const uri = /^spotify:playlist:(.+)$/.exec(trimmed);
  if (uri) return uri[1] && ID.test(uri[1]) ? { provider: "spotify", id: uri[1] } : null;

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    // Texte qui n'est pas une URL : pas un lien Spotify.
    return null;
  }
  if (url.hostname.toLowerCase() !== "open.spotify.com") return null;
  const id = PATH.exec(url.pathname)?.[1];
  return id ? { provider: "spotify", id } : null;
}

import type { PlaylistRef } from "@/core/models";

const HOSTS = /^(music\.|www\.|m\.)?youtube\.com$/i;
const LIST_ID = /^[A-Za-z0-9_-]{2,64}$/;

/**
 * Extrait l'identifiant `list=` d'un lien YouTube Music ou YouTube (`/playlist` ou
 * `/watch?…&list=`), ou renvoie `null`. Les listes spéciales (Mix, titres likés) sont
 * acceptées ici puis refusées avec un message clair par le provider.
 */
export function parseYouTubePlaylistUrl(input: string): PlaylistRef | null {
  const trimmed = input.trim();
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    // Texte qui n'est pas une URL : pas un lien YouTube.
    return null;
  }
  if (!HOSTS.test(url.hostname)) return null;
  if (url.pathname !== "/playlist" && url.pathname !== "/watch") return null;
  const id = url.searchParams.get("list");
  return id && LIST_ID.test(id) ? { provider: "youtube-music", id } : null;
}

/**
 * Listes générées ou personnelles que l'API ne lit pas avec une clé développeur :
 * Mix automatiques (`RD…`), titres likés (`LM`, `LL`), « À regarder plus tard » (`WL`).
 */
export function specialListReason(id: string): string | null {
  if (id.startsWith("RD")) {
    return "Les « Mix » générés automatiquement par YouTube ne peuvent pas être lus. Enregistre-le d'abord comme playlist.";
  }
  if (id === "LM" || id === "LL" || id === "WL") {
    return "Cette liste est personnelle (titres likés, à regarder plus tard) et ne peut pas être lue. Copie ses titres dans une playlist publique ou non répertoriée.";
  }
  return null;
}

// Modèles métier communs à toutes les plateformes.
// Aucune dépendance à Next.js ni à une API : ce fichier doit rester pur.

export const PROVIDER_IDS = ["spotify", "deezer", "youtube-music", "soundcloud"] as const;

export type ProviderId = (typeof PROVIDER_IDS)[number];

/** Un titre tel qu'une plateforme le décrit. */
export interface Track {
  title: string;
  /** Artiste principal en premier. */
  artists: string[];
  album: string | null;
  durationMs: number | null;
  /** Code ISRC : identifiant le plus fiable pour retrouver un titre ailleurs. */
  isrc: string | null;
  provider: ProviderId;
  /** Identifiant du titre sur sa plateforme (ex. URI Spotify, id Deezer). */
  providerTrackId: string;
}

/** Référence vers une playlist, extraite d'un lien. */
export interface PlaylistRef {
  provider: ProviderId;
  id: string;
}

export interface Playlist {
  ref: PlaylistRef;
  name: string;
  description: string | null;
  tracks: Track[];
  /**
   * Titres présents dans la playlist d'origine mais illisibles (vidéo supprimée ou
   * privée…) : signalés dans le récapitulatif plutôt que passés sous silence.
   */
  unavailableCount?: number;
}

export interface NewPlaylist {
  name: string;
  description: string | null;
  /** Identifiants de titres propres à la plateforme de destination. */
  trackIds: string[];
}

/** Playlist créée sur la plateforme de destination. */
export interface CreatedPlaylist {
  id: string;
  url: string;
}

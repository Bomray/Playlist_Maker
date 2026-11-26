import type {
  CreatedPlaylist,
  NewPlaylist,
  Playlist,
  PlaylistRef,
  ProviderId,
  Track,
} from "@/core/models";

/**
 * Interface commune à toutes les plateformes. Le reste du code ne connaît que
 * cette interface, jamais une API précise. Les méthodes lèvent une
 * `ProviderError` (voir `core/errors.ts`) en cas d'échec.
 */
export interface MusicProvider {
  readonly id: ProviderId;

  /** Extrait la référence d'une playlist depuis un lien, ou `null` s'il n'est pas reconnu. */
  parsePlaylistUrl(url: string): PlaylistRef | null;

  /** Lit une playlist et tous ses titres (pagination comprise). */
  getPlaylist(ref: PlaylistRef): Promise<Playlist>;

  /** Cherche des candidats pour un titre venant d'une autre plateforme. */
  searchTrack(track: Track): Promise<Track[]>;

  /** Crée une playlist pour l'utilisateur connecté et y ajoute les titres. */
  createPlaylist(playlist: NewPlaylist): Promise<CreatedPlaylist>;
}

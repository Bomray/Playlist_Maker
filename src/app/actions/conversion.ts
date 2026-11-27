"use server";
// Server Actions de la conversion : recherche manuelle et création de la playlist.
// Ce sont des points d'entrée publics (requêtes POST directes possibles) : chaque
// entrée est validée avec Zod, et l'accès à Spotify passe par la session de l'utilisateur.
import { z } from "zod";
import { ProviderError } from "@/core/errors";
import type { CreatedPlaylist, Track } from "@/core/models";
import { toUserError, type UserError } from "@/lib/user-error";
import { createConversionProviders } from "@/providers/registry";
import { getSpotifyAccessToken } from "@/providers/spotify/session";

/** Les erreurs levées dans une Server Action sont masquées en production : on les renvoie. */
export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: UserError };

async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e instanceof z.ZodError) {
      // Entrée invalide : venant de notre UI, c'est un bug ou une requête forgée.
      const invalid = new ProviderError({
        kind: "unsupported",
        provider: null,
        message: "Données envoyées invalides.",
        detail: e.message,
      });
      return { ok: false, error: toUserError(invalid) };
    }
    return { ok: false, error: toUserError(e) };
  }
}

function destination() {
  return createConversionProviders(() => getSpotifyAccessToken()).destination;
}

const SearchSchema = z.object({
  title: z.string().trim().min(1).max(300),
  artist: z.string().trim().max(300),
  durationMs: z.number().int().positive().nullable(),
});

/** Recherche manuelle d'un titre sur la destination (correction dans le récapitulatif). */
export async function searchDestinationTrack(
  input: z.input<typeof SearchSchema>,
): Promise<ActionResult<Track[]>> {
  return run(async () => {
    const q = SearchSchema.parse(input);
    // Titre « fictif » construit à partir de la saisie : sans ISRC, seule la recherche
    // texte s'applique. `provider` n'est pas utilisé par la recherche.
    return destination().searchTrack({
      title: q.title,
      artists: q.artist ? [q.artist] : [],
      album: null,
      durationMs: q.durationMs,
      isrc: null,
      provider: "deezer",
      providerTrackId: "manual",
    });
  });
}

// URI Spotify uniquement (seule destination de la V1) ; Spotify plafonne une playlist à 10 000 titres.
const CreateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(300).nullable(),
  trackIds: z
    .array(z.string().regex(/^spotify:track:[A-Za-z0-9]{22}$/))
    .min(1)
    .max(10_000),
});

/** Crée la playlist validée par l'utilisateur sur la destination. */
export async function createConvertedPlaylist(
  input: z.input<typeof CreateSchema>,
): Promise<ActionResult<CreatedPlaylist>> {
  return run(async () => {
    const playlist = CreateSchema.parse(input);
    // Une description vide ne doit pas être envoyée comme chaîne vide.
    return destination().createPlaylist({ ...playlist, description: playlist.description || null });
  });
}

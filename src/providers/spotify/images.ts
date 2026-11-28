// Remplissage en tâche de fond des images (spike 3) : une requête `/tracks/{id}` par morceau
// (pochette + identifiant de l'artiste), puis une requête `/artists/{id}` par artiste (photo).
// Les routes groupées `?ids=` répondent 403 en Development Mode : une requête à la fois.
import { z } from "zod";
import { ProviderError } from "@/core/errors";
import { artistsToFill, saveArtistImage, saveTrackImage, tracksToFill } from "@/lib/db/images";
import type { Db } from "@/lib/db/types";
import { fetchJson } from "@/lib/http";
import { type Clock, createRateLimiter, systemClock } from "@/lib/rate-limit";
import { SPOTIFY_API } from "./api";

const ImageSchema = z.object({ url: z.string(), width: z.number().nullish() });

const TrackSchema = z.object({
  artists: z.array(z.object({ id: z.string().nullish(), name: z.string() })),
  album: z.object({ images: z.array(ImageSchema) }),
});

const ArtistSchema = z.object({ images: z.array(ImageSchema) });

/**
 * La plus petite image d'au moins `min` px de large (sinon la plus grande) : assez nette pour
 * une case de la mosaïque, sans télécharger 1 000 px pour une vignette.
 */
export function pickImage(images: z.infer<typeof ImageSchema>[], min: number): string | null {
  const sized = [...images].sort((a, b) => (a.width ?? 0) - (b.width ?? 0));
  return (sized.find((i) => (i.width ?? 0) >= min) ?? sized.at(-1))?.url ?? null;
}

/** L'artiste du morceau qui porte le nom affiché dans les stats, sinon le premier. */
export function matchArtist(
  artists: z.infer<typeof TrackSchema>["artists"],
  name: string,
): string | null {
  const lower = name.toLocaleLowerCase("fr");
  const same = artists.find((a) => a.name.toLocaleLowerCase("fr") === lower);
  return (same ?? artists[0])?.id ?? null;
}

export interface FillDeps {
  db: Db;
  /** Token de l'application (client credentials), mis en cache par l'appelant. */
  getToken(): Promise<string>;
  clock?: Clock;
}

export interface FillResult {
  tracks: number;
  artists: number;
  /** Arrêt anticipé : Spotify a demandé de ralentir (429), on reprendra à la prochaine heure. */
  rateLimited: boolean;
  /** Autre erreur Spotify qui a interrompu le remplissage (repris à la prochaine heure). */
  failed: boolean;
}

/** Morceaux ou artistes qui n'existent plus chez Spotify : on note qu'il n'y a pas d'image. */
const isMissing = (e: unknown) =>
  e instanceof ProviderError && (e.status === 404 || e.status === 400);

/**
 * Remplit des images jusqu'à épuisement du budget de temps (`budgetMs`). Environ 6 requêtes
 * par seconde, sous le débit mesuré sans 429 (~7/s).
 */
export async function fillImages(deps: FillDeps, budgetMs: number): Promise<FillResult> {
  const clock = deps.clock ?? systemClock;
  const deadline = clock.now() + budgetMs;
  const limiter = createRateLimiter({ limit: 6, windowMs: 1_000, clock });
  const result: FillResult = { tracks: 0, artists: 0, rateLimited: false, failed: false };

  const get = async <T>(path: string, schema: z.ZodType<T>): Promise<T> => {
    await limiter.acquire();
    return fetchJson(`${SPOTIFY_API}${path}`, schema, {
      provider: "spotify",
      headers: { Authorization: `Bearer ${await deps.getToken()}` },
      cache: "no-store",
    });
  };

  /** Exécute une recherche ; renvoie `false` s'il faut s'arrêter (429, panne de Spotify). */
  const attempt = async (run: () => Promise<void>, missing: () => Promise<void>) => {
    try {
      await run();
    } catch (e) {
      if (e instanceof ProviderError && e.kind === "rate_limited") {
        result.rateLimited = true;
        return false;
      }
      if (isMissing(e)) {
        await missing();
        return true;
      }
      if (!(e instanceof ProviderError)) throw e;
      console.warn("Images : remplissage interrompu", e.message);
      result.failed = true;
      return false;
    }
    return true;
  };

  while (clock.now() < deadline) {
    const batch = await tracksToFill(deps.db, 50);
    if (batch.length === 0) break;
    for (const track of batch) {
      if (clock.now() >= deadline) return result;
      const go = await attempt(
        async () => {
          const t = await get(`/tracks/${encodeURIComponent(track.spotifyId)}`, TrackSchema);
          await saveTrackImage(deps.db, track, {
            imageUrl: pickImage(t.album.images, 300),
            artistSpotifyId: matchArtist(t.artists, track.artist),
          });
        },
        () => saveTrackImage(deps.db, track, { imageUrl: null, artistSpotifyId: null }),
      );
      if (!go) return result;
      result.tracks++;
    }
  }

  while (clock.now() < deadline) {
    const batch = await artistsToFill(deps.db, 50);
    if (batch.length === 0) break;
    for (const artist of batch) {
      if (clock.now() >= deadline) return result;
      const go = await attempt(
        async () => {
          const a = await get(`/artists/${encodeURIComponent(artist.spotifyId)}`, ArtistSchema);
          await saveArtistImage(deps.db, artist.name, pickImage(a.images, 600));
        },
        () => saveArtistImage(deps.db, artist.name, null),
      );
      if (!go) return result;
      result.artists++;
    }
  }
  return result;
}

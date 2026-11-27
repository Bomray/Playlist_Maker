// Accès à l'API YouTube Data v3 avec la clé développeur, et traduction des erreurs
// Google en ProviderError typées.
import type { z } from "zod";
import { type ProviderErrorKind, ProviderError } from "@/core/errors";
import { fetchJson } from "@/lib/http";
import { YouTubeErrorSchema } from "./schemas";

export const YOUTUBE_API = "https://www.googleapis.com/youtube/v3";

export interface YouTubeClient {
  get<T>(path: string, params: Record<string, string>, schema: z.ZodType<T>): Promise<T>;
}

/** Raisons documentées par Google (https://developers.google.com/youtube/v3/docs/errors). */
function translate(
  status: number | null,
  reason: string | undefined,
): { kind: ProviderErrorKind; message: string } | null {
  switch (reason) {
    case "quotaExceeded":
    case "dailyLimitExceeded":
      return {
        kind: "quota",
        message: "Quota YouTube du jour épuisé pour l'application. Réessaie demain.",
      };
    case "rateLimitExceeded":
    case "userRateLimitExceeded":
      return {
        kind: "rate_limited",
        message: "Trop de requêtes vers YouTube. Réessaie dans un instant.",
      };
    case "playlistNotFound":
      return { kind: "not_found", message: "Playlist YouTube introuvable (supprimée, ou privée)." };
    case "playlistItemsNotAccessible":
    case "playlistForbidden":
      return {
        kind: "not_accessible",
        message: "Cette playlist YouTube est privée : rends-la publique ou non répertoriée.",
      };
    case "keyInvalid":
    case "accessNotConfigured":
    case "forbidden":
      return {
        kind: "forbidden",
        message: "Clé YouTube refusée : vérifie la configuration du serveur (YOUTUBE_API_KEY).",
      };
  }
  // « API key not valid » arrive en 400 sans raison spécifique (« badRequest »).
  if (status === 400)
    return { kind: "forbidden", message: "Clé YouTube invalide : vérifie YOUTUBE_API_KEY." };
  return null;
}

export function createYouTubeClient(apiKey: string | undefined): YouTubeClient {
  return {
    async get(path, params, schema) {
      if (!apiKey) {
        throw new ProviderError({
          kind: "unsupported",
          provider: "youtube-music",
          message: "YouTube Music n'est pas configuré sur ce serveur (YOUTUBE_API_KEY manquante).",
        });
      }
      const url = `${YOUTUBE_API}${path}?${new URLSearchParams(params).toString()}`;
      try {
        return await fetchJson(url, schema, {
          provider: "youtube-music",
          // En-tête plutôt que `key=` : la clé n'apparaît pas dans les URL ni dans les erreurs.
          headers: { "X-goog-api-key": apiKey },
          cache: "no-store",
        });
      } catch (e) {
        if (!(e instanceof ProviderError) || e.detail === null) throw e;
        const body = YouTubeErrorSchema.safeParse(safeJson(e.detail));
        const reason = body.success ? body.data.error.errors?.[0]?.reason : undefined;
        const translated = translate(e.status, reason);
        if (!translated) throw e;
        throw new ProviderError(
          { ...translated, provider: "youtube-music", status: e.status, detail: e.detail },
          { cause: e },
        );
      }
    },
  };
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    // Corps non JSON (page d'erreur HTML d'un proxy…) : pas de raison exploitable.
    return null;
  }
}

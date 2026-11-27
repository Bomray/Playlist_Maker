// Accès à l'API publique Deezer : limiteur de débit, nouvelles tentatives sur
// quota, et conversion des erreurs « HTTP 200 + objet error » en ProviderError.
import { z } from "zod";
import { type ProviderErrorKind, ProviderError } from "@/core/errors";
import { fetchJson } from "@/lib/http";
import {
  type Clock,
  createRateLimiter,
  type RateLimiter,
  systemClock,
  withRetry,
} from "@/lib/rate-limit";
import { type DeezerErrorBody, DeezerErrorSchema } from "./schemas";

export const DEEZER_API = "https://api.deezer.com";

// Deezer coupe vers 50 requêtes / 5 s (constaté pendant le spike) : on garde de la marge.
const LIMIT = 45;
const WINDOW_MS = 5_000;
const RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1_000;

/** Codes documentés par Deezer (https://developers.deezer.com/api/errors). */
export function kindFromDeezerError(error: DeezerErrorBody): ProviderErrorKind {
  if (error.code === 4) return "rate_limited"; // Quota limit exceeded
  if (error.code === 800) return "not_found"; // Data not found
  if (error.type === "OAuthException" || error.code === 200 || error.code === 300) {
    return "not_accessible"; // ressource privée : un token utilisateur serait nécessaire
  }
  return "unknown";
}

export interface DeezerClient {
  get<T>(pathOrUrl: string, schema: z.ZodType<T>): Promise<T>;
}

export function createDeezerClient({
  limiter = createRateLimiter({ limit: LIMIT, windowMs: WINDOW_MS }),
  clock = systemClock,
}: { limiter?: RateLimiter; clock?: Clock } = {}): DeezerClient {
  async function once<T>(url: string, schema: z.ZodType<T>): Promise<T> {
    await limiter.acquire();
    // Le schéma d'erreur passe en premier : un objet `{ error }` ne peut pas être une réponse valide.
    const body = await fetchJson(url, z.union([DeezerErrorSchema, schema]), {
      provider: "deezer",
      cache: "no-store",
    });
    const asError = DeezerErrorSchema.safeParse(body);
    if (asError.success) {
      const { error } = asError.data;
      throw new ProviderError({
        kind: kindFromDeezerError(error),
        provider: "deezer",
        status: 200,
        message: `Deezer : ${error.message} (code ${error.code})`,
        detail: JSON.stringify(body),
      });
    }
    // Ce n'est pas une erreur : l'union garantit que c'est bien une réponse conforme à `schema`.
    return body as T;
  }

  return {
    async get(pathOrUrl, schema) {
      const url = pathOrUrl.startsWith("https://") ? pathOrUrl : `${DEEZER_API}${pathOrUrl}`;
      // On ne suit que des URL de l'API Deezer (les liens `next` viennent de la réponse).
      if (new URL(url).origin !== DEEZER_API) {
        throw new ProviderError({
          kind: "invalid_response",
          provider: "deezer",
          message: `URL inattendue renvoyée par Deezer : ${url}`,
        });
      }
      return withRetry(() => once(url, schema), {
        retries: RETRIES,
        baseDelayMs: RETRY_BASE_DELAY_MS,
        shouldRetry: (e) => e instanceof ProviderError && e.kind === "rate_limited",
        delayFor: (e) =>
          e instanceof ProviderError && e.retryAfterSeconds !== null
            ? e.retryAfterSeconds * 1000
            : null,
        clock,
      });
    },
  };
}

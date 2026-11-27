// Client de l'API Web Spotify : token utilisateur injecté, nouvelle tentative sur 429.
import type { z } from "zod";
import { ProviderError } from "@/core/errors";
import { fetchJson } from "@/lib/http";
import { type Clock, systemClock, withRetry } from "@/lib/rate-limit";

export const SPOTIFY_API = "https://api.spotify.com/v1";

const RETRIES = 2;
const RETRY_BASE_DELAY_MS = 1_000;
// Au-delà, on préfère afficher l'erreur que bloquer l'utilisateur (Spotify peut demander des heures).
const MAX_RETRY_AFTER_S = 30;

export interface SpotifyApi {
  get<T>(pathOrUrl: string, schema: z.ZodType<T>): Promise<T>;
  post<T>(path: string, body: unknown, schema: z.ZodType<T>): Promise<T>;
}

export interface SpotifyApiDeps {
  /** Renvoie un access token utilisateur valide (rafraîchi si besoin). */
  getAccessToken(): Promise<string>;
  clock?: Clock;
}

function isShortRateLimit(e: unknown): e is ProviderError {
  return (
    e instanceof ProviderError &&
    e.kind === "rate_limited" &&
    (e.retryAfterSeconds ?? 0) <= MAX_RETRY_AFTER_S
  );
}

export function createSpotifyApi({
  getAccessToken,
  clock = systemClock,
}: SpotifyApiDeps): SpotifyApi {
  async function request<T>(
    url: string,
    schema: z.ZodType<T>,
    init: { method: "GET" | "POST"; body?: string; headers?: Record<string, string> },
  ): Promise<T> {
    // Les liens `next` viennent de la réponse : on ne suit que l'API Spotify.
    if (!url.startsWith(`${SPOTIFY_API}/`)) {
      throw new ProviderError({
        kind: "invalid_response",
        provider: "spotify",
        message: `URL inattendue renvoyée par Spotify : ${url}`,
      });
    }
    return withRetry(
      async () => {
        const token = await getAccessToken();
        return fetchJson(url, schema, {
          ...init,
          provider: "spotify",
          cache: "no-store",
          headers: { ...init.headers, Authorization: `Bearer ${token}` },
        });
      },
      {
        retries: RETRIES,
        baseDelayMs: RETRY_BASE_DELAY_MS,
        shouldRetry: isShortRateLimit,
        delayFor: (e) =>
          isShortRateLimit(e) && e.retryAfterSeconds !== null ? e.retryAfterSeconds * 1000 : null,
        clock,
      },
    );
  }

  const absolute = (pathOrUrl: string) =>
    pathOrUrl.startsWith("https://") ? pathOrUrl : `${SPOTIFY_API}${pathOrUrl}`;

  return {
    get: (pathOrUrl, schema) => request(absolute(pathOrUrl), schema, { method: "GET" }),
    post: (path, body, schema) =>
      request(absolute(path), schema, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
  };
}

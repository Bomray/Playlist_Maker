// Stockage de la connexion Spotify dans des cookies chiffrés httpOnly.
import "server-only";
import { z } from "zod";
import { ProviderError } from "@/core/errors";
import { serverEnv } from "@/lib/env";
import { deleteCookie, readSealedCookie, writeSealedCookie } from "@/lib/session";
import { refreshTokens, type SpotifyAuthConfig, type SpotifyTokens } from "./auth";

const OAUTH_COOKIE = "pm_spotify_oauth";
const SESSION_COOKIE = "pm_spotify_session";
const OAUTH_MAX_AGE = 10 * 60; // 10 min pour se connecter
const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 jours (le refresh token reste valable)
const REFRESH_MARGIN_MS = 60_000; // rafraîchir si le token expire dans moins d'une minute

const OAuthStateSchema = z.object({ verifier: z.string(), state: z.string() });
const TokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresAt: z.number(),
  scope: z.string(),
});

export function spotifyAuthConfig(): SpotifyAuthConfig {
  const env = serverEnv();
  return {
    clientId: env.SPOTIFY_CLIENT_ID,
    clientSecret: env.SPOTIFY_CLIENT_SECRET,
    redirectUri: env.SPOTIFY_REDIRECT_URI,
  };
}

/**
 * URL absolue dans l'app, sur le même hôte que l'URI de redirection Spotify.
 * `request.nextUrl.origin` vaut `localhost` en dev même si on visite 127.0.0.1 :
 * les cookies (liés à 127.0.0.1) seraient alors perdus après la redirection.
 */
export function spotifyAppUrl(path: string): URL {
  return new URL(path, serverEnv().SPOTIFY_REDIRECT_URI);
}

export async function saveOAuthState(data: z.infer<typeof OAuthStateSchema>): Promise<void> {
  await writeSealedCookie(OAUTH_COOKIE, data, OAUTH_MAX_AGE);
}

/** Lit puis supprime l'état OAuth : il ne sert qu'une fois. */
export async function consumeOAuthState(): Promise<z.infer<typeof OAuthStateSchema> | null> {
  const data = await readSealedCookie(OAUTH_COOKIE, OAuthStateSchema);
  await deleteCookie(OAUTH_COOKIE);
  return data;
}

export async function saveSpotifyTokens(tokens: SpotifyTokens): Promise<void> {
  await writeSealedCookie(SESSION_COOKIE, tokens, SESSION_MAX_AGE);
}

export async function clearSpotifySession(): Promise<void> {
  await deleteCookie(SESSION_COOKIE);
  await deleteCookie(OAUTH_COOKIE);
}

/** Lecture seule (utilisable pendant le rendu d'une page). */
export async function readSpotifySession(): Promise<SpotifyTokens | null> {
  return readSealedCookie(SESSION_COOKIE, TokensSchema);
}

/**
 * Renvoie un access token valide, en le rafraîchissant si besoin.
 * Écrit un cookie : à appeler uniquement dans une Server Action ou un Route Handler.
 *
 * `minValidityMs` : rafraîchit aussi si le token expire avant ce délai. Sert avant une
 * réponse en flux, où plus aucun cookie ne peut être écrit une fois l'envoi commencé.
 */
export async function getSpotifyAccessToken(
  minValidityMs: number = REFRESH_MARGIN_MS,
): Promise<string> {
  const tokens = await readSpotifySession();
  if (!tokens) {
    throw new ProviderError({
      kind: "unauthorized",
      provider: "spotify",
      message: "Pas connecté à Spotify",
    });
  }
  if (tokens.expiresAt - Date.now() > minValidityMs) return tokens.accessToken;

  const refreshed = await refreshTokens(spotifyAuthConfig(), tokens.refreshToken);
  await saveSpotifyTokens(refreshed);
  return refreshed.accessToken;
}

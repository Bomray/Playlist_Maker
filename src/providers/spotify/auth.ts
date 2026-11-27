// OAuth Spotify : Authorization Code + PKCE.
// Les fonctions reçoivent la configuration en paramètre pour rester testables
// sans variables d'environnement ni Next.js.
import { z } from "zod";
import { fetchJson } from "@/lib/http";

export const SPOTIFY_SCOPES = [
  "playlist-modify-private",
  "playlist-read-private",
  // Nécessaire pour `market=from_token` dans la recherche (sinon HTTP 403
  // « Insufficient client scope ») : pays et type d'abonnement, pas l'e-mail.
  "user-read-private",
] as const;

/** Scopes demandés par l'app mais absents d'une session (connexion faite avant leur ajout). */
export function missingScopes(granted: string): string[] {
  const have = new Set(granted.split(" ").filter(Boolean));
  return SPOTIFY_SCOPES.filter((s) => !have.has(s));
}

const AUTHORIZE_URL = "https://accounts.spotify.com/authorize";
const TOKEN_URL = "https://accounts.spotify.com/api/token";

export interface SpotifyAuthConfig {
  clientId: string;
  /** Facultatif : absent en session cloud, où le proxy ajoute l'en-tête Basic. */
  clientSecret?: string;
  redirectUri: string;
}

export interface SpotifyTokens {
  accessToken: string;
  refreshToken: string;
  /** Horodatage (ms) d'expiration de l'access token. */
  expiresAt: number;
  scope: string;
}

const TokenResponseSchema = z.object({
  access_token: z.string(),
  token_type: z.string(),
  expires_in: z.number(),
  scope: z.string().default(""),
  // Absent lors d'un rafraîchissement si Spotify garde le même refresh token.
  refresh_token: z.string().optional(),
});

export function buildAuthorizeUrl(
  config: SpotifyAuthConfig,
  { codeChallenge, state }: { codeChallenge: string; state: string },
): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    scope: SPOTIFY_SCOPES.join(" "),
    redirect_uri: config.redirectUri,
    code_challenge_method: "S256",
    code_challenge: codeChallenge,
    state,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

/**
 * Prépare la requête vers /api/token.
 * - Secret défini : en-tête `Authorization: Basic` et PAS de `client_id` dans le corps
 *   (le spike a montré que Basic + client_id dans le corps donne `400 invalid_client`
 *   derrière le proxy cloud).
 * - Pas de secret : `client_id` dans le corps, comme le prévoit le flux PKCE public.
 */
export function buildTokenRequest(
  config: SpotifyAuthConfig,
  params: Record<string, string>,
): { headers: Record<string, string>; body: URLSearchParams } {
  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
  };
  const body = new URLSearchParams(params);
  if (config.clientSecret) {
    const basic = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");
    headers.Authorization = `Basic ${basic}`;
  } else {
    body.set("client_id", config.clientId);
  }
  return { headers, body };
}

async function requestTokens(
  config: SpotifyAuthConfig,
  params: Record<string, string>,
  previousRefreshToken?: string,
): Promise<SpotifyTokens> {
  const { headers, body } = buildTokenRequest(config, params);
  const res = await fetchJson(TOKEN_URL, TokenResponseSchema, {
    provider: "spotify",
    method: "POST",
    headers,
    body,
    cache: "no-store",
  });
  const refreshToken = res.refresh_token ?? previousRefreshToken;
  if (!refreshToken) throw new Error("Spotify n'a pas renvoyé de refresh token");
  return {
    accessToken: res.access_token,
    refreshToken,
    expiresAt: Date.now() + res.expires_in * 1000,
    scope: res.scope,
  };
}

export function exchangeCode(
  config: SpotifyAuthConfig,
  { code, codeVerifier }: { code: string; codeVerifier: string },
): Promise<SpotifyTokens> {
  return requestTokens(config, {
    grant_type: "authorization_code",
    code,
    redirect_uri: config.redirectUri,
    code_verifier: codeVerifier,
  });
}

export function refreshTokens(
  config: SpotifyAuthConfig,
  refreshToken: string,
): Promise<SpotifyTokens> {
  return requestTokens(
    config,
    { grant_type: "refresh_token", refresh_token: refreshToken },
    refreshToken,
  );
}

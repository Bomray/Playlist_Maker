// Session : un cookie chiffré httpOnly qui ne contient que l'identifiant de l'utilisateur.
// Les tokens Spotify sont en base, chiffrés (décision 0002, remplace en partie la 0001).
import "server-only";
import { connection } from "next/server";
import { z } from "zod";
import { ProviderError } from "@/core/errors";
import { DatabaseNotConfiguredError, getDb } from "@/lib/db";
import { findUserById } from "@/lib/db/users";
import { serverEnv } from "@/lib/env";
import { deleteCookie, readSealedCookie, writeSealedCookie } from "@/lib/session";
import { type AccountDeps, completeLogin, getValidAccessToken } from "./account";
import type { SpotifyAuthConfig, SpotifyTokens } from "./auth";

const OAUTH_COOKIE = "pm_spotify_oauth";
const SESSION_COOKIE = "pm_session";
// Ancien cookie (tokens dans le cookie, avant la base) : supprimé quand on le croise.
const LEGACY_SESSION_COOKIE = "pm_spotify_session";
const OAUTH_MAX_AGE = 10 * 60; // 10 min pour se connecter
const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 jours

const OAuthStateSchema = z.object({ verifier: z.string(), state: z.string() });
const SessionSchema = z.object({ userId: z.string() });

export function spotifyAuthConfig(): SpotifyAuthConfig {
  const env = serverEnv();
  return {
    clientId: env.SPOTIFY_CLIENT_ID,
    clientSecret: env.SPOTIFY_CLIENT_SECRET,
    redirectUri: env.SPOTIFY_REDIRECT_URI,
  };
}

/** Dépendances du compte Spotify (base, clé de chiffrement, configuration OAuth). */
export function accountDeps(): AccountDeps {
  const key = serverEnv().TOKEN_ENCRYPTION_KEY;
  if (!key) throw new Error("TOKEN_ENCRYPTION_KEY manquante (voir le README).");
  return { db: getDb(), encryptionKey: key, auth: spotifyAuthConfig() };
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

/** Fin de connexion : utilisateur créé ou mis à jour en base, cookie de session posé. */
export async function saveLogin(tokens: SpotifyTokens): Promise<void> {
  const user = await completeLogin(accountDeps(), tokens);
  await writeSealedCookie(SESSION_COOKIE, { userId: user.id }, SESSION_MAX_AGE);
  await deleteCookie(LEGACY_SESSION_COOKIE);
}

export async function clearSpotifySession(): Promise<void> {
  await deleteCookie(SESSION_COOKIE);
  await deleteCookie(LEGACY_SESSION_COOKIE);
  await deleteCookie(OAUTH_COOKIE);
}

export interface SessionInfo {
  userId: string;
  displayName: string | null;
  scope: string;
}

/** Lecture seule (utilisable pendant le rendu d'une page). `null` si pas connecté. */
export async function readSpotifySession(): Promise<SessionInfo | null> {
  const session = await readSealedCookie(SESSION_COOKIE, SessionSchema);
  if (!session) return null;
  // Lecture en base : propre à la requête, jamais pré-rendue (sinon Next.js signale l'appel
  // à Date.now() fait par le pilote pendant le pré-rendu).
  await connection();
  try {
    const user = await findUserById(getDb(), session.userId);
    return user ? { userId: user.id, displayName: user.display_name, scope: user.scope } : null;
  } catch (e) {
    // Sans base configurée, personne ne peut être connecté : on affiche « Se connecter ».
    if (e instanceof DatabaseNotConfiguredError) return null;
    throw e;
  }
}

/**
 * Access token valide pendant au moins `minValidityMs` (rafraîchi en base si besoin).
 * N'écrit plus de cookie : utilisable aussi pendant une réponse en flux.
 */
export async function getSpotifyAccessToken(minValidityMs?: number): Promise<string> {
  const session = await readSealedCookie(SESSION_COOKIE, SessionSchema);
  if (!session) {
    throw new ProviderError({
      kind: "unauthorized",
      provider: "spotify",
      message: "Pas connecté à Spotify",
    });
  }
  return getValidAccessToken(accountDeps(), session.userId, minValidityMs);
}

/** Identifiant de l'utilisateur connecté (vérifié en base), ou erreur « non connecté ». */
export async function requireUserId(): Promise<string> {
  const session = await readSpotifySession();
  if (!session) {
    throw new ProviderError({
      kind: "unauthorized",
      provider: "spotify",
      message: "Connecte-toi à Spotify pour enregistrer tes écoutes.",
    });
  }
  return session.userId;
}

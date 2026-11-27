// Compte Spotify en base (décision 0002) : connexion, et access token toujours valide.
// Dépendances injectées (base, clé, configuration) : testable avec PGlite, sans Next.js.
import { z } from "zod";
import { ProviderError } from "@/core/errors";
import { seal, unseal } from "@/lib/crypto-box";
import type { Db } from "@/lib/db/types";
import {
  findUserById,
  type StoredTokens,
  updateTokens,
  upsertUser,
  type User,
} from "@/lib/db/users";
import { fetchJson } from "@/lib/http";
import { refreshTokens, type SpotifyAuthConfig, type SpotifyTokens } from "./auth";

export interface AccountDeps {
  db: Db;
  /** Clé de chiffrement des tokens (TOKEN_ENCRYPTION_KEY). */
  encryptionKey: string;
  auth: SpotifyAuthConfig;
}

const DEFAULT_MIN_VALIDITY_MS = 60_000;

const ProfileSchema = z.object({ id: z.string(), display_name: z.string().nullish() });

/** Profil de l'utilisateur connecté (identifiant Spotify stable, nom affiché). */
export async function fetchProfile(
  accessToken: string,
): Promise<{ id: string; displayName: string | null }> {
  const me = await fetchJson("https://api.spotify.com/v1/me", ProfileSchema, {
    provider: "spotify",
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  return { id: me.id, displayName: me.display_name ?? null };
}

function encrypt(deps: AccountDeps, tokens: SpotifyTokens): StoredTokens {
  return {
    accessTokenEnc: seal(tokens.accessToken, deps.encryptionKey),
    refreshTokenEnc: seal(tokens.refreshToken, deps.encryptionKey),
    expiresAt: new Date(tokens.expiresAt),
    scope: tokens.scope,
  };
}

function decrypt(deps: AccountDeps, value: string): string {
  const plain = unseal(value, deps.encryptionKey);
  if (typeof plain !== "string") {
    // Clé changée ou valeur abîmée : le token est inutilisable, il faut se reconnecter.
    throw new ProviderError({
      kind: "unauthorized",
      provider: "spotify",
      message: "Session Spotify illisible : reconnecte-toi.",
    });
  }
  return plain;
}

/** Après l'échange du code OAuth : crée ou met à jour l'utilisateur, tokens chiffrés. */
export async function completeLogin(deps: AccountDeps, tokens: SpotifyTokens): Promise<User> {
  const profile = await fetchProfile(tokens.accessToken);
  return upsertUser(deps.db, {
    spotifyUserId: profile.id,
    displayName: profile.displayName,
    tokens: encrypt(deps, tokens),
  });
}

function notConnected(message = "Pas connecté à Spotify"): ProviderError {
  return new ProviderError({ kind: "unauthorized", provider: "spotify", message });
}

/**
 * Access token valide pendant au moins `minValidityMs`, rafraîchi et enregistré si besoin.
 *
 * La tâche horaire et le navigateur peuvent rafraîchir en même temps. Si Spotify fait
 * tourner les refresh tokens, l'un des deux utilise un refresh token déjà remplacé :
 * dans ce cas on relit la base, et si l'autre a enregistré de nouveaux tokens, on les utilise.
 */
export async function getValidAccessToken(
  deps: AccountDeps,
  userId: string,
  minValidityMs = DEFAULT_MIN_VALIDITY_MS,
): Promise<string> {
  const user = await findUserById(deps.db, userId);
  if (!user) throw notConnected();
  if (user.token_expires_at.getTime() - Date.now() > minValidityMs)
    return decrypt(deps, user.access_token_enc);

  let fresh: SpotifyTokens;
  try {
    fresh = await refreshTokens(deps.auth, decrypt(deps, user.refresh_token_enc));
  } catch (e) {
    // 400 invalid_grant : refresh token révoqué ou déjà remplacé.
    if (!(e instanceof ProviderError) || (e.status !== 400 && e.status !== 401)) throw e;
    const latest = await findUserById(deps.db, userId);
    if (
      latest &&
      latest.refresh_token_enc !== user.refresh_token_enc &&
      latest.token_expires_at.getTime() > Date.now()
    ) {
      return decrypt(deps, latest.access_token_enc);
    }
    throw notConnected("Accès Spotify expiré ou révoqué : reconnecte-toi.");
  }
  await updateTokens(deps.db, userId, encrypt(deps, fresh));
  return fresh.accessToken;
}

import { connection, NextResponse } from "next/server";
import { buildAuthorizeUrl } from "@/providers/spotify/auth";
import { codeChallengeS256, createCodeVerifier, createState } from "@/providers/spotify/pkce";
import { saveOAuthState, spotifyAuthConfig } from "@/providers/spotify/session";

/** Démarre la connexion Spotify : génère le verifier PKCE et redirige vers Spotify. */
export async function GET() {
  // Réponse propre à chaque requête : jamais prérendue ni mise en cache.
  await connection();
  const verifier = createCodeVerifier();
  const state = createState();
  await saveOAuthState({ verifier, state });
  const url = buildAuthorizeUrl(spotifyAuthConfig(), {
    codeChallenge: codeChallengeS256(verifier),
    state,
  });
  return NextResponse.redirect(url);
}

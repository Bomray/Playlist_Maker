import { type NextRequest, NextResponse } from "next/server";
import { ProviderError } from "@/core/errors";
import { exchangeCode } from "@/providers/spotify/auth";
import {
  consumeOAuthState,
  saveSpotifyTokens,
  spotifyAppUrl,
  spotifyAuthConfig,
} from "@/providers/spotify/session";

// Tant que l'UI de conversion n'existe pas, on revient sur la page de test.
const AFTER_LOGIN = "/dev/spotify";

function backWithError(message: string) {
  const url = spotifyAppUrl(AFTER_LOGIN);
  url.searchParams.set("auth_error", message);
  return NextResponse.redirect(url);
}

/** Retour de Spotify après la page d'autorisation (URI de redirection déclarée dans le dashboard). */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const saved = await consumeOAuthState();

  const spotifyError = params.get("error");
  if (spotifyError) return backWithError(`Spotify a refusé la connexion : ${spotifyError}`);

  const code = params.get("code");
  const state = params.get("state");
  if (!saved) return backWithError("Session de connexion expirée, recommence.");
  if (!code || !state || state !== saved.state) {
    return backWithError("Paramètre state invalide (tentative de connexion non reconnue).");
  }

  try {
    const tokens = await exchangeCode(spotifyAuthConfig(), { code, codeVerifier: saved.verifier });
    await saveSpotifyTokens(tokens);
  } catch (e) {
    if (e instanceof ProviderError) {
      return backWithError(
        `Échange du code refusé (HTTP ${e.status ?? "?"}) : ${e.detail ?? e.message}`,
      );
    }
    throw e;
  }

  return NextResponse.redirect(spotifyAppUrl(AFTER_LOGIN));
}

import { type NextRequest, NextResponse } from "next/server";
import { ProviderError } from "@/core/errors";
import { exchangeCode } from "@/providers/spotify/auth";
import {
  consumeOAuthState,
  saveSpotifyTokens,
  spotifyAuthConfig,
} from "@/providers/spotify/session";

// Tant que l'UI de conversion n'existe pas, on revient sur la page de test.
const AFTER_LOGIN = "/dev/spotify";

function backWithError(request: NextRequest, message: string) {
  const url = new URL(AFTER_LOGIN, request.nextUrl.origin);
  url.searchParams.set("auth_error", message);
  return NextResponse.redirect(url);
}

/** Retour de Spotify après la page d'autorisation (URI de redirection déclarée dans le dashboard). */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const saved = await consumeOAuthState();

  const spotifyError = params.get("error");
  if (spotifyError)
    return backWithError(request, `Spotify a refusé la connexion : ${spotifyError}`);

  const code = params.get("code");
  const state = params.get("state");
  if (!saved) return backWithError(request, "Session de connexion expirée, recommence.");
  if (!code || !state || state !== saved.state) {
    return backWithError(
      request,
      "Paramètre state invalide (tentative de connexion non reconnue).",
    );
  }

  try {
    const tokens = await exchangeCode(spotifyAuthConfig(), { code, codeVerifier: saved.verifier });
    await saveSpotifyTokens(tokens);
  } catch (e) {
    if (e instanceof ProviderError) {
      return backWithError(
        request,
        `Échange du code refusé (HTTP ${e.status ?? "?"}) : ${e.detail ?? e.message}`,
      );
    }
    throw e;
  }

  return NextResponse.redirect(new URL(AFTER_LOGIN, request.nextUrl.origin));
}

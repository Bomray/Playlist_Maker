import { type NextRequest, NextResponse } from "next/server";
import { clearSpotifySession } from "@/providers/spotify/session";

/** Déconnexion : supprime les cookies Spotify. En POST pour qu'un simple lien ne déconnecte pas. */
export async function POST(request: NextRequest) {
  await clearSpotifySession();
  // 303 : le navigateur suit la redirection en GET.
  return NextResponse.redirect(new URL("/dev/spotify", request.nextUrl.origin), 303);
}

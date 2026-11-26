import { NextResponse } from "next/server";
import { clearSpotifySession, spotifyAppUrl } from "@/providers/spotify/session";

/** Déconnexion : supprime les cookies Spotify. En POST pour qu'un simple lien ne déconnecte pas. */
export async function POST() {
  await clearSpotifySession();
  // 303 : le navigateur suit la redirection en GET.
  return NextResponse.redirect(spotifyAppUrl("/dev/spotify"), 303);
}

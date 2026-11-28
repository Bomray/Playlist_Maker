import { LogIn, LogOut } from "lucide-react";
import { readSpotifySession } from "@/providers/spotify/session";

const PILL =
  "flex h-10 items-center gap-2 rounded-full px-3 text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";

/** Connexion à Spotify ou, une fois connecté, le nom du compte et la déconnexion. */
export async function AccountButton() {
  const session = await readSpotifySession();

  if (!session) {
    // Lien simple (pas <Link>) : ni préchargement ni navigation côté client.
    return (
      <a href="/api/auth/spotify/login" className={`${PILL} bg-primary text-primary-foreground`}>
        <LogIn className="size-4" aria-hidden />
        <span className="hidden sm:inline">Se connecter à Spotify</span>
        <span className="sm:hidden">Connexion</span>
      </a>
    );
  }

  const name = session.displayName ?? "Compte Spotify";
  return (
    <form action="/api/auth/spotify/logout" method="post" className="flex items-center gap-1">
      <span
        className="hidden max-w-40 truncate text-sm text-muted-foreground lg:inline"
        title={name}
      >
        {name}
      </span>
      <button
        type="submit"
        className={`${PILL} text-muted-foreground hover:bg-accent hover:text-foreground`}
        aria-label={`Se déconnecter (${name})`}
        title="Se déconnecter"
      >
        <LogOut className="size-4" aria-hidden />
      </button>
    </form>
  );
}

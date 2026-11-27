import { Suspense } from "react";
import { ConversionApp } from "@/components/conversion/conversion-app";
import { Button, buttonVariants } from "@/components/ui/button";
import { missingScopes } from "@/providers/spotify/auth";
import { readSpotifySession } from "@/providers/spotify/session";

export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8 sm:py-12">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">Playlist Maker</h1>
        <p className="text-muted-foreground">
          Convertis une playlist Deezer en playlist Spotify, à partir de son lien.
        </p>
      </header>
      {/* Lecture des cookies et de l'URL au moment de la requête : derrière un Suspense. */}
      <Suspense fallback={<p className="text-sm text-muted-foreground">Chargement…</p>}>
        <SessionGate searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function SessionGate({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const params = await searchParams;
  const authError = typeof params.auth_error === "string" ? params.auth_error : null;
  const session = await readSpotifySession();
  const missing = session ? missingScopes(session.scope) : [];

  return (
    <div className="flex flex-col gap-6">
      {authError && (
        <div role="alert" className="rounded-lg border border-destructive/60 p-3 text-sm">
          <p className="font-semibold text-destructive">Échec de la connexion à Spotify</p>
          <p className="mt-1 break-words whitespace-pre-wrap">{authError}</p>
        </div>
      )}

      {session ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2 text-sm">
          <span>Connecté à Spotify</span>
          <form action="/api/auth/spotify/logout" method="post">
            <Button type="submit" variant="ghost" size="sm">
              Se déconnecter
            </Button>
          </form>
        </div>
      ) : (
        <div className="flex flex-col items-start gap-2 rounded-lg border p-3 text-sm">
          <p>Connecte-toi à Spotify : la playlist sera créée sur ton compte.</p>
          {/* Lien simple (pas <Link>) : ni préchargement ni navigation côté client. */}
          <a href="/api/auth/spotify/login" className={buttonVariants({ size: "lg" })}>
            Se connecter à Spotify
          </a>
        </div>
      )}

      {missing.length > 0 && (
        <div role="alert" className="rounded-lg border border-destructive/60 p-3 text-sm">
          <p className="font-semibold text-destructive">Droits manquants</p>
          <p className="mt-1">
            Ta connexion date d&apos;avant l&apos;ajout de : <code>{missing.join(", ")}</code>.
            Déconnecte-toi puis reconnecte-toi pour les accorder.
          </p>
        </div>
      )}

      {session && missing.length === 0 && <ConversionApp />}
    </div>
  );
}

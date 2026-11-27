// TEMPORAIRE : page de test de l'écriture Spotify en Development Mode.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { readSpotifySession } from "@/providers/spotify/session";
import { TestRunner } from "./test-runner";

export const metadata: Metadata = { title: "Test Spotify (dev)" };

export default function DevSpotifyPage({ searchParams }: PageProps<"/dev/spotify">) {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Test Spotify (dev)</h1>
        <p className="text-sm text-muted-foreground">
          Vérifie le provider Spotify contre la vraie API : recherche avec et sans ISRC, création
          d&apos;une playlist privée, relecture, et refus attendu sur une playlist tierce.
        </p>
      </header>
      {/* Lecture des cookies et de l'URL au moment de la requête : derrière un Suspense. */}
      <Suspense fallback={<p className="text-sm text-muted-foreground">Chargement…</p>}>
        <SessionPanel searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function SessionPanel({
  searchParams,
}: {
  searchParams: PageProps<"/dev/spotify">["searchParams"];
}) {
  const params = await searchParams;
  const authError = typeof params.auth_error === "string" ? params.auth_error : null;
  const session = await readSpotifySession();

  return (
    <div className="flex flex-col gap-6">
      {authError && (
        <div role="alert" className="rounded-lg border border-destructive/60 p-3 text-sm">
          <p className="font-semibold text-destructive">Échec de la connexion</p>
          <p className="mt-1 break-words whitespace-pre-wrap">{authError}</p>
        </div>
      )}

      <section aria-labelledby="session-title" className="flex flex-col gap-3">
        <h2 id="session-title" className="text-lg font-semibold">
          Connexion
        </h2>
        {session ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm">
              Connecté. Scopes : <code className="break-all">{session.scope || "(aucun)"}</code>
            </p>
            <form action="/api/auth/spotify/logout" method="post">
              <Button type="submit" variant="outline">
                Se déconnecter
              </Button>
            </form>
          </div>
        ) : (
          <div className="flex flex-col items-start gap-2">
            <p className="text-sm">Pas connecté.</p>
            {/* Lien simple (pas <Link>) : on ne veut ni préchargement ni navigation côté client. */}
            <a href="/api/auth/spotify/login" className={buttonVariants({ size: "lg" })}>
              Se connecter à Spotify
            </a>
          </div>
        )}
      </section>

      {session && <TestRunner />}
    </div>
  );
}

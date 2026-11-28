import type { Metadata } from "next";
import { Suspense } from "react";
import { ConversionApp } from "@/components/conversion/conversion-app";
import { PageIntro } from "@/components/layout/page-intro";
import { missingScopes } from "@/providers/spotify/auth";
import { readSpotifySession } from "@/providers/spotify/session";

export const metadata: Metadata = { title: "Convertir une playlist" };

export default function ConvertPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 pt-8 sm:px-6 sm:pt-12">
      <PageIntro title="Convertir une playlist">
        Colle le lien d&apos;une playlist Deezer ou YouTube Music : Wavl retrouve chaque titre sur
        Spotify et crée la playlist sur ton compte.
      </PageIntro>
      {/* Lecture du cookie de session au moment de la requête : derrière un Suspense. */}
      <Suspense fallback={<p className="text-sm text-muted-foreground">Chargement…</p>}>
        <SessionGate />
      </Suspense>
    </main>
  );
}

async function SessionGate() {
  const session = await readSpotifySession();
  const missing = session ? missingScopes(session.scope) : [];

  if (!session) {
    return (
      <div className="glass flex flex-col items-start gap-3 rounded-2xl p-5 text-sm">
        <p>Connecte-toi à Spotify : la playlist sera créée sur ton compte.</p>
        {/* Lien simple (pas <Link>) : ni préchargement ni navigation côté client. */}
        <a
          href="/api/auth/spotify/login"
          className="inline-flex h-10 items-center rounded-full bg-primary px-5 font-medium text-primary-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          Se connecter à Spotify
        </a>
      </div>
    );
  }

  if (missing.length > 0) {
    return (
      <div role="alert" className="glass rounded-2xl border-destructive/60 p-4 text-sm">
        <p className="font-semibold text-destructive">Droits manquants</p>
        <p className="mt-1">
          Ta connexion date d&apos;avant l&apos;ajout de : <code>{missing.join(", ")}</code>.
          Déconnecte-toi puis reconnecte-toi pour les accorder.
        </p>
      </div>
    );
  }

  return <ConversionApp />;
}

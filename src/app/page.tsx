import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthErrorAlert, PageIntro } from "@/components/layout/page-intro";
import { StatsApp } from "@/components/stats/stats-app";
import { readSpotifySession } from "@/providers/spotify/session";

export const metadata: Metadata = { title: "Mes stats d'écoute" };

export default function StatsPage({ searchParams }: PageProps<"/">) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 pt-8 sm:px-6 sm:pt-12">
      <PageIntro title="Mes stats d'écoute">
        Temps d&apos;écoute, nombre d&apos;écoutes et tops, à partir de ton export de données
        Spotify puis de tes nouvelles écoutes.
      </PageIntro>
      {/* Lecture du cookie de session et de l'URL au moment de la requête : derrière un Suspense. */}
      <Suspense fallback={<p className="text-sm text-muted-foreground">Chargement…</p>}>
        <StatsForSession searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function StatsForSession({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const params = await searchParams;
  const authError = typeof params.auth_error === "string" ? params.auth_error : null;
  const session = await readSpotifySession();
  return (
    <>
      <AuthErrorAlert message={authError} />
      <StatsApp loggedIn={session !== null} />
    </>
  );
}

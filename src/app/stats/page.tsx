import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { StatsApp } from "@/components/stats/stats-app";
import { readSpotifySession } from "@/providers/spotify/session";

export const metadata: Metadata = { title: "Mes stats d'écoute — Playlist Maker" };

export default function StatsPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8 sm:py-12">
      <header className="flex flex-col gap-1">
        <Link href="/" className="text-sm text-muted-foreground underline-offset-2 hover:underline">
          ← Conversion de playlists
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">Mes stats d&apos;écoute</h1>
        <p className="text-muted-foreground">
          Temps d&apos;écoute, nombre d&apos;écoutes et tops, à partir de ton export de données
          Spotify.
        </p>
      </header>
      {/* Lecture du cookie de session au moment de la requête : derrière un Suspense. */}
      <Suspense fallback={<p className="text-sm text-muted-foreground">Chargement…</p>}>
        <StatsForSession />
      </Suspense>
    </main>
  );
}

async function StatsForSession() {
  const session = await readSpotifySession();
  return <StatsApp loggedIn={session !== null} />;
}

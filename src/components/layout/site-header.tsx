import Link from "next/link";
import { Suspense } from "react";
import { Wordmark } from "@/components/brand/logo";
import { AccountButton } from "./account-button";
import { MainNav } from "./main-nav";
import { ThemeToggle } from "./theme-toggle";

/** Barre du haut en verre : logo, sections (écrans larges), thème et compte. */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 px-4 pt-4 sm:px-6">
      <div className="glass mx-auto flex max-w-6xl items-center gap-3 rounded-full py-2 pr-2 pl-4">
        <Link
          href="/"
          aria-label="Wavl, accueil"
          className="rounded-full focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <Wordmark />
        </Link>
        <MainNav />
        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          {/* Lecture du cookie de session au moment de la requête : derrière un Suspense. */}
          <Suspense fallback={<span className="h-10 w-10" aria-hidden />}>
            <AccountButton />
          </Suspense>
        </div>
      </div>
    </header>
  );
}

/** Fond d'aurore : purement décoratif, derrière tout le contenu. */
export function Aurora() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="aurora-blob aurora-blob-1" />
      <div className="aurora-blob aurora-blob-2" />
    </div>
  );
}

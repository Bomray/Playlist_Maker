"use client";
// Navigation vers les pages artiste / album / titre, qui restent sur « / » (paramètres d'URL).
// `history.pushState` plutôt que le routeur : aucun aller-retour avec le serveur, les écoutes
// chargées dans le navigateur restent en mémoire. Next.js met à jour useSearchParams.
import { useSearchParams } from "next/navigation";
import { type MouseEvent, type ReactNode, useMemo } from "react";
import {
  type Selection,
  selectionFromParams,
  selectionToParams,
  type TopEntry,
} from "@/core/stats";
import type { ImageKind } from "./images";

export function useSelection(): Selection | null {
  const params = useSearchParams();
  const query = params.toString();
  // Mémorisé sur le texte de l'URL : un nouvel objet à chaque rendu relancerait les calculs.
  return useMemo(() => selectionFromParams(new URLSearchParams(query)), [query]);
}

export const selectionHref = (s: Selection) => `/?${selectionToParams(s).toString()}`;

export function closeSelection(): void {
  window.history.pushState(null, "", "/");
}

/** Sélection correspondant à une entrée des tops. */
export function entrySelection(kind: ImageKind, e: TopEntry): Selection {
  if (kind === "artist") return { kind: "artist", artist: e.label };
  const i = e.key.indexOf("\u0000");
  if (kind === "album") return { kind: "album", artist: e.key.slice(0, i), album: e.label };
  return {
    kind: "track",
    artist: e.sublabel ?? "",
    title: e.label,
    uri: e.key.startsWith("spotify:") ? e.key : null,
  };
}

/** Navigation sans rechargement vers une autre vue de « / » (détail, tops complets). */
export function navigate(href: string): void {
  window.history.pushState(null, "", href);
  window.scrollTo({ top: 0 });
}

/**
 * Vrai lien (ouvrable dans un nouvel onglet), mais navigation sans rechargement au clic simple.
 */
export function PushLink({
  href,
  className,
  children,
  label,
}: {
  href: string;
  className?: string;
  children: ReactNode;
  label?: string;
}) {
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(href);
  };
  return (
    <a href={href} onClick={onClick} className={className} aria-label={label}>
      {children}
    </a>
  );
}

/** Lien vers la page d'un artiste, d'un album ou d'un titre. */
export function SelectionLink({
  selection,
  ...rest
}: {
  selection: Selection;
  className?: string;
  children: ReactNode;
  label?: string;
}) {
  return <PushLink href={selectionHref(selection)} {...rest} />;
}

// Tops complets : « /?tops=titres » (ou artistes, albums).
export const TOPS_TABS = [
  { value: "titres", kind: "topTracks", label: "Titres" },
  { value: "artistes", kind: "topArtists", label: "Artistes" },
  { value: "albums", kind: "topAlbums", label: "Albums" },
] as const;
export type TopsTab = (typeof TOPS_TABS)[number]["value"];

export function useTopsTab(): TopsTab | null {
  const value = useSearchParams().get("tops");
  return TOPS_TABS.find((t) => t.value === value)?.value ?? null;
}

export const topsHref = (tab: TopsTab) => `/?tops=${tab}`;

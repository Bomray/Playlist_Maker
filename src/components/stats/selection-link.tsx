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

export function openSelection(s: Selection): void {
  window.history.pushState(null, "", selectionHref(s));
  window.scrollTo({ top: 0 });
}

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

/**
 * Lien vers une page de détail : vrai lien (ouvrable dans un nouvel onglet), mais navigation
 * sans rechargement au clic simple.
 */
export function SelectionLink({
  selection,
  className,
  children,
  label,
}: {
  selection: Selection;
  className?: string;
  children: ReactNode;
  label?: string;
}) {
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    openSelection(selection);
  };
  return (
    <a href={selectionHref(selection)} onClick={onClick} className={className} aria-label={label}>
      {children}
    </a>
  );
}

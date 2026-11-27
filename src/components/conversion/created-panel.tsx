"use client";

import { useEffect, useRef } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import type { ConversionReport } from "@/core/convert";
import type { CreatedPlaylist } from "@/core/models";
import { countLabel } from "./format";

interface Props {
  report: ConversionReport;
  created: CreatedPlaylist;
  added: number;
  onRestart: () => void;
}

/** Étape 4 : playlist créée. */
export function CreatedPanel({ report, created, added, onRestart }: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []);
  const missing = report.summary.total - added;

  return (
    <section aria-labelledby="created-title" className="flex flex-col gap-3">
      <h2
        id="created-title"
        ref={headingRef}
        tabIndex={-1}
        className="text-lg font-semibold outline-none"
      >
        Playlist créée
      </h2>
      <p className="text-sm">
        {countLabel(added, "titre")} {added > 1 ? "ajoutés" : "ajouté"} sur Spotify.
        {missing > 0 &&
          ` ${countLabel(missing, "titre")} ${missing > 1 ? "n'ont pas été ajoutés" : "n'a pas été ajouté"}.`}
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <a
          href={created.url}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ size: "lg" })}
        >
          Ouvrir dans Spotify
          <span className="sr-only"> (nouvel onglet)</span>
        </a>
        <Button size="lg" variant="outline" onClick={onRestart}>
          Convertir une autre playlist
        </Button>
      </div>
    </section>
  );
}

"use client";

import { useId, useState, useTransition } from "react";
import { searchDestinationTrack } from "@/app/actions/conversion";
import { Button } from "@/components/ui/button";
import type { Track } from "@/core/models";
import type { UserError } from "@/lib/user-error";
import { ErrorAlert } from "./error-alert";
import { inputClass } from "./playlist-form";

interface Props {
  source: Track;
  /** Résultats trouvés : le parent les affiche comme candidats. */
  onResults: (tracks: Track[]) => void;
}

/** Recherche à la main sur Spotify, pré-remplie avec le titre et l'artiste d'origine. */
export function ManualSearch({ source, onResults }: Props) {
  const id = useId();
  const [title, setTitle] = useState(source.title);
  const [artist, setArtist] = useState(source.artists[0] ?? "");
  const [error, setError] = useState<UserError | null>(null);
  const [empty, setEmpty] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const res = await searchDestinationTrack({
            title,
            artist,
            durationMs: source.durationMs,
          });
          setError(res.ok ? null : res.error);
          setEmpty(res.ok && res.data.length === 0);
          if (res.ok) onResults(res.data);
        });
      }}
    >
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-title`} className="text-xs font-medium">
            Titre
          </label>
          <input
            id={`${id}-title`}
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-artist`} className="text-xs font-medium">
            Artiste
          </label>
          <input
            id={`${id}-artist`}
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            className={inputClass}
          />
        </div>
        <Button type="submit" variant="secondary" disabled={pending} className="h-10">
          {pending ? "Recherche…" : "Rechercher"}
        </Button>
      </div>
      <div aria-live="polite">
        {empty && <p className="text-sm text-muted-foreground">Aucun résultat sur Spotify.</p>}
        {error && <ErrorAlert error={error} />}
      </div>
    </form>
  );
}

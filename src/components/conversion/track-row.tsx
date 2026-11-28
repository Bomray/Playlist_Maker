"use client";

import { useState } from "react";
import { gradientFor } from "@/components/brand/gradient";
import { Button } from "@/components/ui/button";
import { scoreCandidate, type ScoredCandidate, type TrackMatch } from "@/core/matching";
import type { Track } from "@/core/models";
import { artistsLabel, formatDuration, formatScore } from "./format";
import { ManualSearch } from "./manual-search";

interface Props {
  match: TrackMatch;
  onSelect: (track: Track | null) => void;
}

function TrackLine({ track, className }: { track: Track; className?: string }) {
  return (
    <span className={className}>
      <span className="font-medium">{track.title}</span>
      <span className="text-muted-foreground">
        {" "}
        — {artistsLabel(track)} · {formatDuration(track.durationMs)}
      </span>
    </span>
  );
}

/** Petite pochette (dégradé si absente). Décorative : le titre est écrit à côté. */
function Mini({ url, name }: { url?: string; name: string }) {
  return (
    <span
      aria-hidden
      className="relative size-10 shrink-0 overflow-hidden rounded-lg"
      style={{ background: gradientFor(name) }}
    >
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className="size-full object-cover"
        />
      )}
    </span>
  );
}

/** Un titre du récapitulatif : choix actuel, et correction possible. */
export function TrackRow({ match, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const [extra, setExtra] = useState<ScoredCandidate[]>([]);
  const { source, selected, best } = match;
  const name = `« ${source.title} »`;

  // Candidats d'origine + résultats de recherche manuelle, sans doublons.
  const candidates = [...extra, ...match.candidates].filter(
    (c, i, all) => all.findIndex((o) => o.track.providerTrackId === c.track.providerTrackId) === i,
  );
  const scoreOf = (t: Track) =>
    candidates.find((c) => c.track.providerTrackId === t.providerTrackId)?.score ?? null;

  return (
    <li className="flex flex-col gap-2 rounded-2xl border bg-background/40 p-3">
      <div className="flex items-center gap-3">
        <Mini url={source.artworkUrl} name={source.title} />
        <TrackLine track={source} className="min-w-0 text-sm break-words" />
      </div>

      <div className="flex items-center gap-3">
        <Mini url={(selected ?? best?.track)?.artworkUrl} name={source.title} />
        <p className="min-w-0 text-sm break-words">
          {selected ? (
            <>
              <span className="font-semibold text-green-700 dark:text-green-400">Ajouté : </span>
              <TrackLine track={selected} />
              {scoreOf(selected) !== null && (
                <span className="text-muted-foreground">
                  {" "}
                  · confiance {formatScore(scoreOf(selected)!)}
                </span>
              )}
            </>
          ) : best ? (
            <>
              <span className="font-semibold text-amber-700 dark:text-amber-400">
                Proposé (non ajouté) :{" "}
              </span>
              <TrackLine track={best.track} />
              <span className="text-muted-foreground"> · confiance {formatScore(best.score)}</span>
            </>
          ) : (
            <span className="text-muted-foreground">Aucun résultat sur Spotify.</span>
          )}
        </p>
      </div>
      {match.error && <p className="text-xs text-destructive">{match.error.message}</p>}

      <div className="flex flex-wrap gap-2">
        {best && selected?.providerTrackId !== best.track.providerTrackId && (
          <Button
            size="sm"
            onClick={() => onSelect(best.track)}
            aria-label={`Valider la proposition pour ${name}`}
          >
            Valider
          </Button>
        )}
        {selected && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onSelect(null)}
            aria-label={`Retirer ${name}`}
          >
            Retirer
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          aria-expanded={open}
          aria-label={`${open ? "Masquer" : "Corriger"} ${name}`}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? "Masquer" : "Corriger"}
        </Button>
      </div>

      {open && (
        <div className="flex flex-col gap-3 border-t pt-3">
          {candidates.length > 0 && (
            <fieldset className="flex flex-col gap-1">
              <legend className="mb-1 text-xs font-medium">Choisir un titre Spotify</legend>
              {candidates.map((c) => {
                const checked = selected?.providerTrackId === c.track.providerTrackId;
                return (
                  <label
                    key={c.track.providerTrackId}
                    className="flex cursor-pointer items-start gap-2 rounded-md p-2 text-sm hover:bg-muted has-checked:bg-muted"
                  >
                    <input
                      type="radio"
                      name={`choice-${source.providerTrackId}`}
                      checked={checked}
                      onChange={() => onSelect(c.track)}
                      className="mt-1 accent-primary"
                    />
                    <span className="break-words">
                      <TrackLine track={c.track} />
                      <span className="text-muted-foreground"> · {formatScore(c.score)}</span>
                    </span>
                  </label>
                );
              })}
            </fieldset>
          )}
          <ManualSearch
            source={source}
            onResults={(tracks) => setExtra(tracks.map((t) => scoreCandidate(source, t)))}
          />
        </div>
      )}
    </li>
  );
}

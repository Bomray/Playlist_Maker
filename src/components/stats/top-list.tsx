"use client";

import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { type Stats, TOP_LIMIT, type TopEntry } from "@/core/stats";
import { type DurationUnit, formatDuration } from "./duration";
import { formatInt } from "./format";
import { gradientFor } from "@/components/brand/gradient";
import { Artwork, type ImageKind, useImage } from "./images";
import { entrySelection, PushLink, SelectionLink, topsHref, type TopsTab } from "./selection-link";
import { useDurationUnit } from "./use-duration-unit";

export type Kind = "topTracks" | "topArtists" | "topAlbums";
type Metric = "plays" | "msPlayed";

const KINDS: { kind: Kind; label: string }[] = [
  { kind: "topTracks", label: "Titres" },
  { kind: "topArtists", label: "Artistes" },
  { kind: "topAlbums", label: "Albums" },
];

const TAB_OF: Record<Kind, TopsTab> = {
  topTracks: "titres",
  topArtists: "artistes",
  topAlbums: "albums",
};

export const IMAGE_KIND: Record<Kind, ImageKind> = {
  topTracks: "track",
  topArtists: "artist",
  topAlbums: "album",
};

/** Vignette : pochette (carrée) ou photo d'artiste (ronde), dégradé en attendant. */
export function Thumb({ entry, kind }: { entry: TopEntry; kind: ImageKind }) {
  const src = useImage(kind, entry);
  const round = kind === "artist";
  return (
    <span
      aria-hidden
      className={`relative size-10 shrink-0 overflow-hidden ${round ? "rounded-full" : "rounded-lg"}`}
      style={{ background: gradientFor(entry.label) }}
    >
      <Artwork src={src} round={round} />
    </span>
  );
}

const value = (e: TopEntry, metric: Metric) => (metric === "plays" ? e.plays : e.msPlayed);
const display = (e: TopEntry, metric: Metric, unit: DurationUnit) =>
  metric === "plays" ? `${formatInt(e.plays)} écoutes` : formatDuration(e.msPlayed, unit);

/** Tops titres / artistes / albums, classés par écoutes ou par temps d'écoute. */
export function TopList({
  stats,
  kinds = ["topTracks", "topArtists", "topAlbums"],
  title = "Tops",
  showAll = false,
}: {
  /** Lien vers les tops complets (page principale seulement). */
  showAll?: boolean;
  stats: Stats;
  /** Classements proposés (une page d'album n'a que ses titres). */
  kinds?: Kind[];
  title?: string;
}) {
  const [kind, setKind] = useState<Kind>(kinds[0] ?? "topTracks");
  const [metric, setMetric] = useState<Metric>("plays");
  const [expanded, setExpanded] = useState(false);
  const [unit] = useDurationUnit();

  const entries = [...stats[kind]]
    .sort((a, b) => value(b, metric) - value(a, metric))
    .slice(0, TOP_LIMIT);
  const shown = expanded ? entries : entries.slice(0, 10);
  const max = Math.max(1, ...entries.map((e) => value(e, metric)));

  return (
    <section
      aria-labelledby="top-title"
      className="glass flex flex-col gap-3 rounded-3xl p-4 sm:p-6"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id="top-title" className="text-lg font-semibold">
          {title}
        </h2>
        {showAll && (
          <PushLink
            href={topsHref(TAB_OF[kind])}
            className="flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium text-primary hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            Tous les tops
            <ArrowRight className="size-4" aria-hidden />
          </PushLink>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {kinds.length > 1 && (
          <div role="group" aria-label="Classement" className="flex gap-1">
            {KINDS.filter((k) => kinds.includes(k.kind)).map((k) => (
              <Button
                key={k.kind}
                size="sm"
                variant={kind === k.kind ? "default" : "outline"}
                aria-pressed={kind === k.kind}
                onClick={() => setKind(k.kind)}
              >
                {k.label}
              </Button>
            ))}
          </div>
        )}
        <div role="group" aria-label="Trier par" className="flex gap-1">
          <Button
            size="sm"
            variant={metric === "plays" ? "secondary" : "ghost"}
            aria-pressed={metric === "plays"}
            onClick={() => setMetric("plays")}
          >
            Écoutes
          </Button>
          <Button
            size="sm"
            variant={metric === "msPlayed" ? "secondary" : "ghost"}
            aria-pressed={metric === "msPlayed"}
            onClick={() => setMetric("msPlayed")}
          >
            Temps
          </Button>
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune écoute sur cette période.</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {shown.map((e, i) => (
            <li key={e.key} className="flex items-center gap-3">
              <span className="w-6 shrink-0 text-right text-sm text-muted-foreground tabular-nums">
                {i + 1}
              </span>
              <Thumb entry={e} kind={IMAGE_KIND[kind]} />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 break-words">
                    <SelectionLink
                      selection={entrySelection(IMAGE_KIND[kind], e)}
                      className="font-medium underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
                    >
                      {e.label}
                    </SelectionLink>
                    {e.sublabel && <span className="text-muted-foreground"> — {e.sublabel}</span>}
                  </span>
                  <span className="shrink-0 text-muted-foreground tabular-nums">
                    {display(e, metric, unit)}
                  </span>
                </div>
                {/* Barre proportionnelle au premier du classement (décorative : la valeur est écrite). */}
                <div aria-hidden className="h-1.5 rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-viz-series"
                    style={{ width: `${(value(e, metric) / max) * 100}%` }}
                  />
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
      {entries.length > 10 && (
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          aria-expanded={expanded}
          onClick={() => setExpanded((x) => !x)}
        >
          {expanded ? "Voir moins" : `Voir le top ${entries.length}`}
        </Button>
      )}
    </section>
  );
}

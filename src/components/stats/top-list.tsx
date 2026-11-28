"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { type Stats, TOP_LIMIT, type TopEntry } from "@/core/stats";
import { type DurationUnit, formatDuration } from "./duration";
import { formatInt } from "./format";
import { useDurationUnit } from "./use-duration-unit";

type Kind = "topTracks" | "topArtists" | "topAlbums";
type Metric = "plays" | "msPlayed";

const KINDS: { kind: Kind; label: string }[] = [
  { kind: "topTracks", label: "Titres" },
  { kind: "topArtists", label: "Artistes" },
  { kind: "topAlbums", label: "Albums" },
];

const value = (e: TopEntry, metric: Metric) => (metric === "plays" ? e.plays : e.msPlayed);
const display = (e: TopEntry, metric: Metric, unit: DurationUnit) =>
  metric === "plays" ? `${formatInt(e.plays)} écoutes` : formatDuration(e.msPlayed, unit);

/** Tops titres / artistes / albums, classés par écoutes ou par temps d'écoute. */
export function TopList({ stats }: { stats: Stats }) {
  const [kind, setKind] = useState<Kind>("topTracks");
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
      <h2 id="top-title" className="text-lg font-semibold">
        Tops
      </h2>
      <div className="flex flex-wrap gap-2">
        <div role="group" aria-label="Classement" className="flex gap-1">
          {KINDS.map((k) => (
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
            <li key={e.key} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 break-words">
                  <span className="mr-2 inline-block w-6 text-right text-muted-foreground tabular-nums">
                    {i + 1}
                  </span>
                  <span className="font-medium">{e.label}</span>
                  {e.sublabel && <span className="text-muted-foreground"> — {e.sublabel}</span>}
                </span>
                <span className="shrink-0 text-muted-foreground tabular-nums">
                  {display(e, metric, unit)}
                </span>
              </div>
              {/* Barre proportionnelle au premier du classement (décorative : la valeur est écrite). */}
              <div aria-hidden className="ml-8 h-1.5 rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-viz-series"
                  style={{ width: `${(value(e, metric) / max) * 100}%` }}
                />
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

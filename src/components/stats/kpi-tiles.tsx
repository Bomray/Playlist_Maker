"use client";
// Carte principale : temps d'écoute de la période (minutes par défaut, ou heures) et chiffres clés.
import { type Period, periodLabel, type Stats } from "@/core/stats";
import { durationValue, formatDuration, unitLabel } from "./duration";
import { formatInt } from "./format";
import { DurationToggle, useDurationUnit } from "./use-duration-unit";

function Tile({ value, label }: { value: string; label: string }) {
  return (
    <li className="flex flex-col rounded-2xl bg-background/50 px-3 py-2">
      <span className="font-heading text-xl font-semibold tabular-nums">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </li>
  );
}

export function KpiTiles({ stats, period }: { stats: Stats; period: Period }) {
  const [unit] = useDurationUnit();
  const { music, podcasts } = stats;
  return (
    <section
      aria-label="Chiffres clés"
      className="glass flex flex-col gap-4 rounded-3xl p-4 sm:p-6"
    >
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">
          Temps d&apos;écoute {periodLabel(period)}
        </h2>
        <DurationToggle />
      </div>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="font-heading text-5xl font-bold tracking-tight tabular-nums sm:text-6xl">
          {durationValue(music.msPlayed, unit)}
        </span>
        <span className="text-lg text-muted-foreground">
          {unitLabel(music.msPlayed, unit)} d&apos;écoute
        </span>
      </p>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Tile value={formatInt(music.plays)} label="écoutes" />
        <Tile value={formatInt(music.distinctTracks)} label="titres différents" />
        <Tile value={formatInt(music.distinctArtists)} label="artistes" />
        <Tile value={formatInt(music.activeDays)} label="jours d'écoute" />
      </ul>
      {(music.shortPlays > 0 || podcasts.msPlayed > 0) && (
        <p className="text-xs text-muted-foreground">
          {music.shortPlays > 0 &&
            `${formatInt(music.shortPlays)} lectures de moins de 30 s (titres passés) comptent dans le temps mais pas dans les écoutes. `}
          {podcasts.msPlayed > 0 && (
            <>
              <span className="font-medium text-foreground">Podcasts</span> (comptés à part) :{" "}
              {formatDuration(podcasts.msPlayed, unit)}, {formatInt(podcasts.episodes)} épisodes.
            </>
          )}
        </p>
      )}
    </section>
  );
}

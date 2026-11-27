import { splitDuration, type Stats } from "@/core/stats";
import { formatDecimal, formatHours, formatInt } from "./format";

function Tile({ value, label }: { value: string; label: string }) {
  return (
    <li className="flex flex-col rounded-lg bg-muted p-3">
      <span className="text-2xl font-semibold tabular-nums">{value}</span>
      <span className="text-sm text-muted-foreground">{label}</span>
    </li>
  );
}

/** Chiffres clés de la période : temps d'écoute (minutes, heures, jours) et écoutes. */
export function KpiTiles({ stats }: { stats: Stats }) {
  const { music, podcasts } = stats;
  const d = splitDuration(music.msPlayed);
  return (
    <section aria-label="Chiffres clés" className="flex flex-col gap-3">
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Tile value={formatInt(d.minutes)} label="minutes d'écoute" />
        <Tile value={formatInt(d.hours)} label="heures" />
        <Tile value={formatDecimal(d.days)} label="jours" />
        <Tile value={formatInt(music.plays)} label="écoutes" />
      </ul>
      <p className="text-sm text-muted-foreground">
        {formatInt(music.distinctTracks)} titres et {formatInt(music.distinctArtists)} artistes
        différents, sur {formatInt(music.activeDays)} jours d&apos;écoute.{" "}
        {formatInt(music.shortPlays)} lectures de moins de 30&nbsp;s (titres passés) comptent dans
        le temps mais pas dans les écoutes.
      </p>
      {podcasts.msPlayed > 0 && (
        <p className="rounded-lg border p-3 text-sm">
          <span className="font-medium">Podcasts</span> (comptés à part) :{" "}
          {formatHours(podcasts.msPlayed)}, {formatInt(podcasts.episodes)} épisodes.
        </p>
      )}
    </section>
  );
}

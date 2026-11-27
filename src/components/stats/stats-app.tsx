"use client";
// Écran des stats : dépôt de l'export → lecture (progression) → stats par période.
import { Button } from "@/components/ui/button";
import type { Stats } from "@/core/stats";
import { type Column, ColumnChart } from "./column-chart";
import { ExportDrop } from "./export-drop";
import { formatDate, formatInt, monthLabels, WEEKDAY_LABELS, WEEKDAY_NAMES } from "./format";
import { KpiTiles } from "./kpi-tiles";
import { TopList } from "./top-list";
import { type Period, useStats } from "./use-stats";

function charts(stats: Stats, period: Period): { title: string; columns: Column[] }[] {
  const out: { title: string; columns: Column[] }[] = [];
  if (period.kind === "all" && stats.byYear.length > 1) {
    out.push({
      title: "Temps d'écoute par année",
      columns: stats.byYear.map((b) => ({ ...b, label: b.key, axisLabel: b.key })),
    });
  }
  out.push({
    title: "Temps d'écoute par mois",
    columns: stats.byMonth.map((b) => {
      const { long, short } = monthLabels(b.key);
      // Sur plusieurs années, une étiquette par année (janvier) pour ne pas surcharger l'axe.
      const axisLabel =
        period.kind === "year" ? short : b.key.endsWith("-01") ? `'${b.key.slice(2, 4)}` : null;
      return { ...b, label: long, axisLabel };
    }),
  });
  out.push({
    title: "Par jour de la semaine",
    columns: stats.byWeekday.map((b, i) => ({
      ...b,
      label: WEEKDAY_NAMES[i] ?? b.key,
      axisLabel: WEEKDAY_LABELS[i] ?? null,
    })),
  });
  out.push({
    title: "Par heure de la journée",
    columns: stats.byHour.map((b, i) => ({
      ...b,
      label: `${i} h – ${i + 1} h`,
      axisLabel: i % 3 === 0 ? `${i}h` : null,
    })),
  });
  return out;
}

export function StatsApp() {
  const { state, load, selectPeriod, reset } = useStats();

  if (state.phase === "idle") {
    return (
      <div className="flex flex-col gap-4">
        <ExportDrop onFiles={load} />
        {state.error && (
          <div role="alert" className="rounded-lg border border-destructive/60 p-3 text-sm">
            <p className="font-semibold text-destructive">Lecture impossible</p>
            <p className="mt-1">{state.error}</p>
          </div>
        )}
      </div>
    );
  }

  if (state.phase === "loading") {
    return (
      <section aria-labelledby="loading-title" className="flex flex-col gap-3">
        <h2 id="loading-title" className="text-lg font-semibold">
          Lecture de l&apos;export…
        </h2>
        <progress
          className="h-2 w-full accent-primary"
          max={state.total ?? undefined}
          value={state.total === null ? undefined : state.done}
          aria-label="Progression de la lecture"
        />
        <p aria-live="polite" className="text-sm text-muted-foreground">
          {state.total === null
            ? "Décompression de l'archive…"
            : `Fichier ${state.done} / ${state.total}`}
        </p>
      </section>
    );
  }

  const { stats, period, years } = state;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>
          {formatInt(state.plays)} lectures dans {state.historyFiles} fichier
          {state.historyFiles > 1 ? "s" : ""}
          {state.skippedEntries > 0 &&
            ` (${formatInt(state.skippedEntries)} entrées ignorées : livres audio ou format inconnu)`}
        </span>
        <Button variant="outline" size="sm" onClick={reset}>
          Changer d&apos;export
        </Button>
      </div>

      <div role="group" aria-label="Période" className="flex flex-wrap gap-1">
        <Button
          size="sm"
          variant={period.kind === "all" ? "default" : "outline"}
          aria-pressed={period.kind === "all"}
          onClick={() => selectPeriod({ kind: "all" })}
        >
          Tout
        </Button>
        {years.map((y) => {
          const active = period.kind === "year" && period.year === y;
          return (
            <Button
              key={y}
              size="sm"
              variant={active ? "default" : "outline"}
              aria-pressed={active}
              onClick={() => selectPeriod({ kind: "year", year: y })}
            >
              {y}
            </Button>
          );
        })}
      </div>

      {!stats ? (
        <p aria-live="polite" className="text-sm text-muted-foreground">
          Calcul des stats…
        </p>
      ) : (
        <>
          <p className="text-sm">
            {stats.range
              ? `Du ${formatDate(stats.range.first)} au ${formatDate(stats.range.last)}`
              : "Aucune écoute sur cette période."}
          </p>
          <KpiTiles stats={stats} />
          <div className="grid gap-6 sm:grid-cols-2">
            {charts(stats, period).map((c) => (
              <ColumnChart key={c.title} title={c.title} columns={c.columns} />
            ))}
          </div>
          <TopList stats={stats} />
        </>
      )}
    </div>
  );
}

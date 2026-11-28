"use client";
// Stats d'une période : temps d'écoute, n°1, évolution, tops et moments d'écoute.
import type { Period, Stats } from "@/core/stats";
import { type Column, ColumnChart } from "./column-chart";
import { EvolutionCard } from "./evolution-card";
import { formatDate, WEEKDAY_LABELS, WEEKDAY_NAMES } from "./format";
import { KpiTiles } from "./kpi-tiles";
import { Mosaic } from "./mosaic";
import { TopList } from "./top-list";

function moments(stats: Stats): { title: string; columns: Column[] }[] {
  return [
    {
      title: "Par jour de la semaine",
      columns: stats.byWeekday.map((b, i) => ({
        ...b,
        label: WEEKDAY_NAMES[i] ?? b.key,
        axisLabel: WEEKDAY_LABELS[i] ?? null,
      })),
    },
    {
      title: "Par heure de la journée",
      columns: stats.byHour.map((b, i) => ({
        ...b,
        label: `${i} h – ${i + 1} h`,
        axisLabel: i % 3 === 0 ? `${i}h` : null,
      })),
    },
  ];
}

export function StatsDashboard({ stats, period }: { stats: Stats | null; period: Period }) {
  if (!stats) {
    return (
      <p aria-live="polite" className="text-sm text-muted-foreground">
        Calcul des stats…
      </p>
    );
  }
  if (!stats.range) {
    return (
      <p className="glass rounded-3xl p-6 text-sm text-muted-foreground">
        Aucune écoute sur cette période. Choisis une autre période ci-dessus.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">
        Du {formatDate(stats.range.first)} au {formatDate(stats.range.last)}
      </p>
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <KpiTiles stats={stats} period={period} />
        </div>
        <div className="lg:col-span-3">
          <Mosaic stats={stats} />
        </div>
      </div>
      <EvolutionCard stats={stats} period={period} />
      <div className="grid gap-6 lg:grid-cols-2">
        <TopList stats={stats} />
        <section
          aria-labelledby="moments-title"
          className="glass flex flex-col gap-6 rounded-3xl p-4 sm:p-6"
        >
          <h2 id="moments-title" className="text-lg font-semibold">
            Quand tu écoutes
          </h2>
          {moments(stats).map((c) => (
            <ColumnChart key={c.title} title={c.title} columns={c.columns} />
          ))}
        </section>
      </div>
    </div>
  );
}

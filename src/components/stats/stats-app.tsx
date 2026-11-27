"use client";
// Écran des stats : dépôt de l'export → lecture (progression) → stats par période.
import { Button } from "@/components/ui/button";
import type { Stats } from "@/core/stats";
import { type Column, ColumnChart } from "./column-chart";
import { AccountPanel } from "./account-panel";
import { CollectPanel } from "./collect-panel";
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

export function StatsApp({ loggedIn }: { loggedIn: boolean }) {
  const { state, load, loadAccount, selectPeriod, upload, deleteAccountData, reset } =
    useStats(loggedIn);

  const collect = loggedIn && state.phase !== "loading" && (
    <CollectPanel onNewPlays={loadAccount} />
  );

  if (state.phase === "idle") {
    return (
      <div className="flex flex-col gap-4">
        {collect}
        {state.notice && (
          <p aria-live="polite" className="rounded-lg bg-muted p-3 text-sm">
            {state.notice}
          </p>
        )}
        {state.accountEmpty && (
          <p className="text-sm">
            Aucun historique enregistré dans ton compte pour l&apos;instant : dépose ton export,
            puis enregistre-le.
          </p>
        )}
        <ExportDrop onFiles={load} loggedIn={loggedIn} />
        {state.error && (
          <div
            role="alert"
            className="flex flex-col items-start gap-2 rounded-lg border border-destructive/60 p-3 text-sm"
          >
            <p className="font-semibold text-destructive">Lecture impossible</p>
            <p>{state.error}</p>
            {loggedIn && (
              <Button size="sm" variant="outline" onClick={loadAccount}>
                Recharger mon historique enregistré
              </Button>
            )}
          </div>
        )}
      </div>
    );
  }

  if (state.phase === "loading") {
    const fromAccount = state.source === "account";
    return (
      <section aria-labelledby="loading-title" className="flex flex-col gap-3">
        <h2 id="loading-title" className="text-lg font-semibold">
          {fromAccount ? "Chargement de ton historique…" : "Lecture de l'export…"}
        </h2>
        <progress
          className="h-2 w-full accent-primary"
          max={state.total || undefined}
          value={state.total ? state.done : undefined}
          aria-label="Progression du chargement"
        />
        <p aria-live="polite" className="text-sm text-muted-foreground">
          {state.total === null
            ? fromAccount
              ? "Connexion à ton compte…"
              : "Décompression de l'archive…"
            : fromAccount
              ? `${formatInt(state.done)} / ${formatInt(state.total)} écoutes`
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
          {state.source === "account"
            ? `${formatInt(state.plays)} écoutes enregistrées`
            : `${formatInt(state.plays)} lectures dans ${state.historyFiles} fichier${state.historyFiles > 1 ? "s" : ""}`}
          {state.skippedEntries > 0 &&
            ` (${formatInt(state.skippedEntries)} entrées ignorées : livres audio ou format inconnu)`}
        </span>
        {state.source === "file" && (
          <Button variant="outline" size="sm" onClick={reset}>
            Changer d&apos;export
          </Button>
        )}
      </div>

      {collect}

      <AccountPanel
        loggedIn={loggedIn}
        source={state.source}
        plays={state.plays}
        upload={state.upload}
        onUpload={upload}
        onShowAccount={loadAccount}
        onAddExport={reset}
        onDelete={deleteAccountData}
      />

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

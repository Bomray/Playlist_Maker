"use client";
// Carte « Évolution » : courbe (pas jour / semaine / mois) ou calendrier jour par jour.
import { useMemo, useState } from "react";
import {
  calendar,
  dayKey,
  defaultStep,
  evolution,
  type Period,
  periodBounds,
  type Stats,
  type Step,
} from "@/core/stats";
import { ActivityCalendar } from "./activity-calendar";
import { EvolutionCurve } from "./evolution-curve";
import { Segmented } from "./segmented";
import { DurationToggle, useDurationUnit } from "./use-duration-unit";

type View = "curve" | "calendar";

const VIEWS = [
  { value: "curve", label: "Courbe" },
  { value: "calendar", label: "Calendrier" },
] as const;

const STEPS = [
  { value: "day", label: "Jour" },
  { value: "week", label: "Semaine" },
  { value: "month", label: "Mois" },
] as const;

/** Jours couverts : bornes de la période, limitées aux écoutes (« tout ») et à aujourd'hui. */
function span(stats: Stats, period: Period): { from: string; to: string } | null {
  if (!stats.range) return null;
  const b = periodBounds(period);
  const from = b.from ?? stats.range.first;
  const to = Math.min(b.to ?? stats.range.last, Math.max(Date.now(), stats.range.last));
  return { from: dayKey(new Date(from)), to: dayKey(new Date(to)) };
}

export function EvolutionCard({ stats, period }: { stats: Stats; period: Period }) {
  const [unit] = useDurationUnit();
  const [view, setView] = useState<View>("curve");
  const range = span(stats, period);
  // Pas choisi à la main ; à défaut, celui qui convient à la durée de la période.
  const [chosenStep, setChosenStep] = useState<Step | null>(null);
  const step = chosenStep ?? (range ? defaultStep(range.from, range.to) : "day");

  const from = range?.from;
  const to = range?.to;
  const points = useMemo(
    () => (from && to ? evolution(stats.byDay, step, from, to) : []),
    [stats.byDay, step, from, to],
  );
  const weeks = useMemo(
    () => (from && to && view === "calendar" ? calendar(stats.byDay, from, to) : []),
    [stats.byDay, view, from, to],
  );

  return (
    <section
      aria-labelledby="evolution-title"
      className="glass flex flex-col gap-4 rounded-3xl p-4 sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="evolution-title" className="text-lg font-semibold">
          Évolution
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {view === "curve" && (
            <Segmented
              label="Pas de la courbe"
              value={step}
              options={STEPS}
              onChange={setChosenStep}
            />
          )}
          <Segmented label="Affichage" value={view} options={VIEWS} onChange={setView} />
          <DurationToggle />
        </div>
      </div>
      {!range ? (
        <p className="text-sm text-muted-foreground">Aucune écoute sur cette période.</p>
      ) : view === "curve" ? (
        <EvolutionCurve points={points} step={step} unit={unit} />
      ) : (
        <ActivityCalendar weeks={weeks} unit={unit} />
      )}
    </section>
  );
}

"use client";
// Courbe d'évolution du temps d'écoute : ligne lissée, aire en dégradé, pic signalé.
// Survol (souris, doigt) ou flèches du clavier pour lire chaque point.
import { type KeyboardEvent, type PointerEvent, useId, useState } from "react";
import { parseDayKey, type Point, type Step } from "@/core/stats";
import { smoothPath } from "./curve-path";
import { formatDuration, type DurationUnit } from "./duration";
import { formatInt } from "./format";

const W = 1000;
const H = 200;
const PAD_TOP = 24;

const dayFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });
const dayYearFmt = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
});
const monthFmt = new Intl.DateTimeFormat("fr-FR", { month: "short", year: "numeric" });

export function pointLabel(key: string, step: Step, withYear = true): string {
  const d = parseDayKey(key);
  if (!d) return key;
  if (step === "month") return monthFmt.format(d);
  const day = (withYear ? dayYearFmt : dayFmt).format(d);
  return step === "week" ? `sem. du ${day}` : day;
}

interface Props {
  points: Point[];
  step: Step;
  unit: DurationUnit;
}

export function EvolutionCurve({ points, step, unit }: Props) {
  const gradient = useId().replace(/:/g, "");
  const [active, setActive] = useState<number | null>(null);
  const n = points.length;
  if (n === 0) return null;

  const max = Math.max(1, ...points.map((p) => p.msPlayed));
  const xy = points.map((p, i) => ({
    x: n === 1 ? W / 2 : (i / (n - 1)) * W,
    y: H - (p.msPlayed / max) * (H - PAD_TOP),
  }));
  const line = smoothPath(xy);
  const area = `${line}L${xy[n - 1]!.x},${H}L${xy[0]!.x},${H}Z`;
  const peakIndex = points.reduce(
    (best, p, i) => (p.msPlayed > points[best]!.msPlayed ? i : best),
    0,
  );
  const peak = points[peakIndex]!;
  const shown = active ?? peakIndex;
  const at = (i: number) => ({ left: `${(xy[i]!.x / W) * 100}%`, top: `${(xy[i]!.y / H) * 100}%` });

  const onPointer = (e: PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    setActive(Math.round(ratio * (n - 1)));
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, Home: -n, End: n };
    const move = moves[e.key];
    if (move === undefined) return;
    e.preventDefault();
    setActive((i) => Math.min(n - 1, Math.max(0, (i ?? peakIndex) + move)));
  };

  const p = points[shown]!;
  const summary = `Pic ${pointLabel(peak.key, step)} : ${formatDuration(peak.msPlayed, unit)}.`;

  return (
    <div className="flex flex-col gap-2">
      {/* Lecture du point survolé (ou du pic) : ligne fixe, elle ne déborde jamais de l'écran. */}
      <p aria-live="polite" className="min-h-5 text-sm">
        <span className="text-muted-foreground">{active === null ? "Pic · " : ""}</span>
        {pointLabel(p.key, step)} ·{" "}
        <span className="font-semibold">{formatDuration(p.msPlayed, unit)}</span> ·{" "}
        {formatInt(p.plays)} écoute{p.plays > 1 ? "s" : ""}
      </p>
      <div
        role="img"
        tabIndex={0}
        aria-label={`Courbe du temps d'écoute. ${summary} Flèches gauche et droite pour parcourir.`}
        onPointerMove={onPointer}
        onPointerLeave={() => setActive(null)}
        onKeyDown={onKey}
        onBlur={() => setActive(null)}
        className="relative h-44 touch-pan-y rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:h-52"
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="curve-reveal absolute inset-0 size-full overflow-visible"
          aria-hidden
        >
          <defs>
            <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--viz-series)" stopOpacity="0.35" />
              <stop offset="1" stopColor="var(--viz-series)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75].map((f) => (
            <line
              key={f}
              x1="0"
              x2={W}
              y1={H - f * (H - PAD_TOP)}
              y2={H - f * (H - PAD_TOP)}
              stroke="var(--border)"
              strokeDasharray="4 6"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          <path d={area} fill={`url(#${gradient})`} />
          <path
            d={line}
            fill="none"
            stroke="var(--viz-series)"
            strokeWidth="2.5"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
          {active !== null && (
            <line
              x1={xy[active]!.x}
              x2={xy[active]!.x}
              y1={PAD_TOP / 2}
              y2={H}
              stroke="var(--muted-foreground)"
              strokeOpacity="0.5"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
        {/* Points en HTML : un cercle SVG serait déformé par preserveAspectRatio="none". */}
        <span
          aria-hidden
          className="absolute size-3 -translate-1/2 rounded-full border-2 border-background bg-viz-series shadow"
          style={at(shown)}
        />
      </div>
      <div aria-hidden className="flex justify-between text-xs text-muted-foreground">
        <span>{pointLabel(points[0]!.key, step, false)}</span>
        {n > 2 && <span>{pointLabel(points[Math.floor((n - 1) / 2)]!.key, step, false)}</span>}
        <span>{pointLabel(points[n - 1]!.key, step, false)}</span>
      </div>
    </div>
  );
}

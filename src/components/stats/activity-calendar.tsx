"use client";
// Calendrier jour par jour : une colonne par semaine (lundi en haut), couleur selon le temps
// d'écoute du jour. Sur une longue période, il défile horizontalement (dernière semaine visible).
import { useEffect, useRef } from "react";
import type { CalendarCell } from "@/core/stats";
import { formatDuration, type DurationUnit } from "./duration";
import { formatInt, WEEKDAY_LABELS } from "./format";
import { pointLabel } from "./evolution-curve";

const LEVEL_CLASS = [
  "bg-muted",
  "bg-viz-series/25",
  "bg-viz-series/50",
  "bg-viz-series/75",
  "bg-viz-series",
] as const;

const monthFmt = new Intl.DateTimeFormat("fr-FR", { month: "short" });

interface Props {
  weeks: (CalendarCell | null)[][];
  unit: DurationUnit;
}

export function ActivityCalendar({ weeks, unit }: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [weeks]);

  const cells = weeks.flat().filter((c) => c !== null);
  const listened = cells.filter((c) => c.msPlayed > 0);
  const best = listened.reduce<CalendarCell | null>(
    (b, c) => (!b || c.msPlayed > b.msPlayed ? c : b),
    null,
  );

  // Nom du mois au-dessus de la première semaine qui le contient.
  const monthOf = (week: (CalendarCell | null)[]) => week.find((c) => c !== null)?.key.slice(5, 7);
  const monthHeads = weeks.map((week, w) => {
    const month = monthOf(week);
    if (!month || (w > 0 && monthOf(weeks[w - 1]!) === month)) return null;
    return monthFmt.format(new Date(2000, Number(month) - 1, 1));
  });

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        {formatInt(listened.length)} jour{listened.length > 1 ? "s" : ""} d&apos;écoute sur{" "}
        {formatInt(cells.length)}
        {best && (
          <>
            {" "}
            · record le {pointLabel(best.key, "day")} ({formatDuration(best.msPlayed, unit)})
          </>
        )}
      </p>
      {/* Détail au survol (title) : décoratif pour les lecteurs d'écran, résumé ci-dessus. */}
      <div ref={scroller} aria-hidden className="overflow-x-auto pb-2">
        <div className="flex w-max gap-[3px]">
          <div className="mr-1 grid grid-rows-[1rem_repeat(7,0.75rem)] gap-[3px] text-[10px] leading-3 text-muted-foreground">
            <span />
            {WEEKDAY_LABELS.map((d, i) => (
              <span key={d}>{i % 2 === 0 ? d : ""}</span>
            ))}
          </div>
          {weeks.map((week, w) => (
            <div key={w} className="grid grid-rows-[1rem_repeat(7,0.75rem)] gap-[3px]">
              <span className="w-3 overflow-visible text-[10px] leading-3 whitespace-nowrap text-muted-foreground">
                {monthHeads[w]}
              </span>
              {week.map((c, d) =>
                c ? (
                  <span
                    key={c.key}
                    title={`${pointLabel(c.key, "day")} : ${formatDuration(c.msPlayed, unit)}, ${formatInt(c.plays)} écoute${c.plays > 1 ? "s" : ""}`}
                    className={`size-3 rounded-[3px] ${LEVEL_CLASS[c.level]}`}
                  />
                ) : (
                  <span key={d} className="size-3" />
                ),
              )}
            </div>
          ))}
        </div>
      </div>
      <div aria-hidden className="flex items-center gap-1 self-end text-xs text-muted-foreground">
        Moins
        {LEVEL_CLASS.map((cls) => (
          <span key={cls} className={`size-3 rounded-[3px] ${cls}`} />
        ))}
        Plus
      </div>
    </div>
  );
}

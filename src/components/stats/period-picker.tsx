"use client";
// Sélecteur de période global : raccourcis, années précises et plage libre.
import { CalendarRange } from "lucide-react";
import { type FormEvent, useState } from "react";
import { cn } from "cn";
import { dayKey, type Period, samePeriod } from "@/core/stats";

const PRESETS: { period: Period; label: string }[] = [
  { period: { kind: "today" }, label: "Aujourd'hui" },
  { period: { kind: "yesterday" }, label: "Hier" },
  { period: { kind: "days", days: 7 }, label: "7 jours" },
  { period: { kind: "days", days: 30 }, label: "30 jours" },
  { period: { kind: "months", months: 6 }, label: "6 mois" },
  { period: { kind: "months", months: 12 }, label: "12 mois" },
  { period: { kind: "all" }, label: "Tout" },
];

const CHIP =
  "h-8 shrink-0 rounded-full px-3 text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        CHIP,
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

interface Props {
  period: Period;
  years: number[];
  onChange: (period: Period) => void;
}

export function PeriodPicker({ period, years, onChange }: Props) {
  const [rangeOpen, setRangeOpen] = useState(period.kind === "range");
  const today = dayKey(new Date());
  const firstDay = years.length > 0 ? `${years[0]}-01-01` : undefined;
  const [from, setFrom] = useState(period.kind === "range" ? period.from : today);
  const [to, setTo] = useState(period.kind === "range" ? period.to : today);

  const applyRange = (e: FormEvent) => {
    e.preventDefault();
    if (from && to) onChange({ kind: "range", from, to });
  };

  return (
    <div className="glass flex flex-col gap-2 rounded-3xl p-2">
      {/* Défilement horizontal sur téléphone plutôt qu'un retour à la ligne sur 4 rangées. */}
      <div role="group" aria-label="Période" className="flex gap-1 overflow-x-auto">
        {PRESETS.map((p) => (
          <Chip
            key={p.label}
            active={samePeriod(p.period, period)}
            onClick={() => onChange(p.period)}
          >
            {p.label}
          </Chip>
        ))}
        {years.length > 0 &&
          [...years].reverse().map((y) => (
            <Chip
              key={y}
              active={period.kind === "year" && period.year === y}
              onClick={() => onChange({ kind: "year", year: y })}
            >
              {y}
            </Chip>
          ))}
        <button
          type="button"
          aria-expanded={rangeOpen}
          aria-controls="period-range"
          onClick={() => setRangeOpen((o) => !o)}
          className={cn(
            CHIP,
            "flex items-center gap-1.5",
            period.kind === "range"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-foreground",
          )}
        >
          <CalendarRange className="size-4" aria-hidden />
          Plage libre
        </button>
      </div>
      {rangeOpen && (
        <form
          id="period-range"
          onSubmit={applyRange}
          className="flex flex-wrap items-end gap-2 px-2 pb-1 text-sm"
        >
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Du</span>
            <input
              type="date"
              required
              value={from}
              min={firstDay}
              max={today}
              onChange={(e) => setFrom(e.target.value)}
              className="h-9 rounded-lg border border-input bg-background px-2"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Au</span>
            <input
              type="date"
              required
              value={to}
              min={firstDay}
              max={today}
              onChange={(e) => setTo(e.target.value)}
              className="h-9 rounded-lg border border-input bg-background px-2"
            />
          </label>
          <button type="submit" className={cn(CHIP, "h-9 bg-primary text-primary-foreground")}>
            Afficher
          </button>
        </form>
      )}
    </div>
  );
}

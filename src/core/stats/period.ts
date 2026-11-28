// Périodes d'affichage des stats (logique pure). Les bornes sont calculées dans le fuseau de
// l'appareil, le même que celui utilisé pour regrouper les écoutes par jour et par mois.

export type Period =
  | { kind: "today" }
  | { kind: "yesterday" }
  | { kind: "days"; days: 7 | 30 }
  | { kind: "months"; months: 6 | 12 }
  | { kind: "year"; year: number }
  | { kind: "all" }
  /** Plage libre, bornes incluses, au format « 2025-03-14 » (jour local). */
  | { kind: "range"; from: string; to: string };

export interface Bounds {
  /** Bornes incluses en ms UTC ; absentes pour « tout ». */
  from?: number;
  to?: number;
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const endOfDay = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime() - 1;

/** « 2025-03-14 » → minuit local de ce jour, ou `null` si la date est invalide. */
export function parseDayKey(key: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.getMonth() === Number(m[2]) - 1 ? d : null;
}

/** Jour local au format « 2025-03-14 ». */
export function dayKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function periodBounds(period: Period, now: Date = new Date()): Bounds {
  const today = startOfDay(now);
  switch (period.kind) {
    case "all":
      return {};
    case "today":
      return { from: today.getTime(), to: endOfDay(today) };
    case "yesterday": {
      const y = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
      return { from: y.getTime(), to: endOfDay(y) };
    }
    case "days": {
      // « 7 jours » = aujourd'hui et les 6 jours d'avant.
      const from = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() - period.days + 1,
      );
      return { from: from.getTime(), to: endOfDay(today) };
    }
    case "months": {
      const from = new Date(
        today.getFullYear(),
        today.getMonth() - period.months,
        today.getDate() + 1,
      );
      return { from: from.getTime(), to: endOfDay(today) };
    }
    case "year":
      return {
        from: new Date(period.year, 0, 1).getTime(),
        to: new Date(period.year + 1, 0, 1).getTime() - 1,
      };
    case "range": {
      const a = parseDayKey(period.from);
      const b = parseDayKey(period.to);
      if (!a || !b) return {};
      const [lo, hi] = a <= b ? [a, b] : [b, a];
      return { from: lo.getTime(), to: endOfDay(hi) };
    }
  }
}

const dayFmt = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** Libellé court d'une période, pour les titres (« en 2025 », « sur 7 jours »…). */
export function periodLabel(period: Period): string {
  switch (period.kind) {
    case "all":
      return "depuis le début";
    case "today":
      return "aujourd'hui";
    case "yesterday":
      return "hier";
    case "days":
      return `sur ${period.days} jours`;
    case "months":
      return `sur ${period.months} mois`;
    case "year":
      return `en ${period.year}`;
    case "range": {
      const a = parseDayKey(period.from);
      const b = parseDayKey(period.to);
      return a && b ? `du ${dayFmt.format(a)} au ${dayFmt.format(b)}` : "sur la période choisie";
    }
  }
}

export function samePeriod(a: Period, b: Period): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

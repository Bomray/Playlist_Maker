// Séries pour la courbe d'évolution et le calendrier jour par jour (logique pure).
import type { Bucket } from "./aggregate";
import { dayKey, parseDayKey } from "./period";

export type Step = "day" | "week" | "month";

export interface Point {
  /** Premier jour du pas, « 2025-03-10 ». */
  key: string;
  msPlayed: number;
  plays: number;
}

const DAY_MS = 86_400_000;

/** Lundi de la semaine du jour donné (minuit local). */
function mondayOf(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
}

function stepStart(d: Date, step: Step): Date {
  if (step === "day") return d;
  if (step === "week") return mondayOf(d);
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function nextStep(d: Date, step: Step): Date {
  if (step === "day") return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  if (step === "week") return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7);
  return new Date(d.getFullYear(), d.getMonth() + 1, 1);
}

/** Pas par défaut selon la durée couverte : jours jusqu'à ~2 mois, semaines jusqu'à ~1 an. */
export function defaultStep(firstKey: string, lastKey: string): Step {
  const a = parseDayKey(firstKey);
  const b = parseDayKey(lastKey);
  if (!a || !b) return "day";
  const days = Math.round((b.getTime() - a.getTime()) / DAY_MS) + 1;
  return days <= 62 ? "day" : days <= 400 ? "week" : "month";
}

/**
 * Regroupe les jours par pas, de `from` à `to` (clés « AAAA-MM-JJ »), en comblant les trous
 * par des zéros : une courbe sans écoute doit retomber à 0, pas relier deux points éloignés.
 */
export function evolution(days: readonly Bucket[], step: Step, from: string, to: string): Point[] {
  const start = parseDayKey(from);
  const end = parseDayKey(to);
  if (!start || !end || start > end) return [];
  const points = new Map<string, Point>();
  for (let d = stepStart(start, step); d <= end; d = nextStep(d, step)) {
    const key = dayKey(d);
    points.set(key, { key, msPlayed: 0, plays: 0 });
  }
  for (const b of days) {
    const d = parseDayKey(b.key);
    if (!d || d < start || d > end) continue;
    const p = points.get(dayKey(stepStart(d, step)));
    if (!p) continue;
    p.msPlayed += b.msPlayed;
    p.plays += b.plays;
  }
  return [...points.values()];
}

export interface CalendarCell {
  key: string;
  msPlayed: number;
  plays: number;
  /** 0 = aucune écoute, 1 à 4 = intensité (par rapport au jour le plus écouté). */
  level: 0 | 1 | 2 | 3 | 4;
}

/**
 * Calendrier jour par jour en colonnes de semaines (lundi en haut), de `from` à `to`.
 * Les cases hors période valent `null` pour garder des colonnes complètes.
 */
export function calendar(
  days: readonly Bucket[],
  from: string,
  to: string,
): (CalendarCell | null)[][] {
  const start = parseDayKey(from);
  const end = parseDayKey(to);
  if (!start || !end || start > end) return [];
  const byKey = new Map(days.map((b) => [b.key, b]));
  // Intensité relative au jour le plus écouté de la période (4 niveaux, comme un dégradé).
  const max = Math.max(
    0,
    ...days.filter((b) => b.key >= from && b.key <= to).map((b) => b.msPlayed),
  );
  const level = (ms: number): CalendarCell["level"] =>
    ms <= 0 || max <= 0
      ? 0
      : (Math.min(4, Math.max(1, Math.ceil((ms / max) * 4))) as 1 | 2 | 3 | 4);

  const weeks: (CalendarCell | null)[][] = [];
  for (let monday = mondayOf(start); monday <= end; monday = nextStep(monday, "week")) {
    const week: (CalendarCell | null)[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
      if (d < start || d > end) {
        week.push(null);
        continue;
      }
      const key = dayKey(d);
      const b = byKey.get(key);
      const ms = b?.msPlayed ?? 0;
      week.push({ key, msPlayed: ms, plays: b?.plays ?? 0, level: level(ms) });
    }
    weeks.push(week);
  }
  return weeks;
}

// Heure de la prochaine collecte automatique. GitHub Actions lance `collect.yml` à la minute 17
// de chaque heure (UTC) ; l'exécution réelle peut avoir quelques minutes de retard.
export const COLLECT_MINUTE = 17;
const HOUR_MS = 3_600_000;

/** Prochain passage prévu, strictement après `now` (ms UTC). */
export function nextCollection(now: number): number {
  const hour = Math.floor(now / HOUR_MS) * HOUR_MS;
  const slot = hour + COLLECT_MINUTE * 60_000;
  return slot > now ? slot : slot + HOUR_MS;
}

/** « 42 min », « 3 min 05 s », « moins d'une minute ». */
export function formatCountdown(ms: number): string {
  if (ms < 60_000) return "moins d'une minute";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes >= 10) return `${minutes} min`;
  return `${minutes} min ${String(seconds).padStart(2, "0")} s`;
}

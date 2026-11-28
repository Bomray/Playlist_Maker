// Affichage des durées en minutes (par défaut) ou en heures, au choix de l'utilisateur.
export type DurationUnit = "minutes" | "hours";

export const DURATION_STORAGE_KEY = "wavl-duration-unit";

export function parseDurationUnit(value: string | null): DurationUnit {
  return value === "hours" ? "hours" : "minutes";
}

const int = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const oneDecimal = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

/** Valeur seule : « 1 234 » minutes ou « 20,6 » heures (entier à partir de 100 h). */
export function durationValue(ms: number, unit: DurationUnit): string {
  if (unit === "minutes") return int.format(Math.round(ms / 60_000));
  const hours = ms / 3_600_000;
  return hours >= 100 ? int.format(Math.round(hours)) : oneDecimal.format(hours);
}

/** Libellé de l'unité accordé à la valeur : « minute(s) », « heure(s) ». */
export function unitLabel(ms: number, unit: DurationUnit): string {
  const n = unit === "minutes" ? Math.round(ms / 60_000) : ms / 3_600_000;
  const word = unit === "minutes" ? "minute" : "heure";
  return n >= 2 ? `${word}s` : word;
}

/** Version courte pour les listes : « 42 min », « 3,5 h ». */
export function formatDuration(ms: number, unit: DurationUnit): string {
  return `${durationValue(ms, unit)} ${unit === "minutes" ? "min" : "h"}`;
}

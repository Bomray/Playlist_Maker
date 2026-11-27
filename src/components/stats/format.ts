// Formats d'affichage des stats (français).
const int = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const oneDecimal = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
const dateFmt = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});
const monthFmt = new Intl.DateTimeFormat("fr-FR", { month: "short", year: "numeric" });
const monthShort = new Intl.DateTimeFormat("fr-FR", { month: "narrow" });

export const formatInt = (n: number) => int.format(n);
export const formatDecimal = (n: number) => oneDecimal.format(n);
export const formatDate = (t: number) => dateFmt.format(t);

/** Durée lisible : « 42 min », « 3,5 h ». */
export function formatHours(ms: number): string {
  const minutes = ms / 60_000;
  if (minutes < 60) return `${int.format(minutes)} min`;
  return `${oneDecimal.format(minutes / 60)} h`;
}

export const WEEKDAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
export const WEEKDAY_NAMES = [
  "lundi",
  "mardi",
  "mercredi",
  "jeudi",
  "vendredi",
  "samedi",
  "dimanche",
];

/** « 2024-03 » → « mars 2024 » (libellé complet) et « M » (étiquette d'axe). */
export function monthLabels(key: string): { long: string; short: string } {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y ?? 1970, (m ?? 1) - 1, 15);
  return { long: monthFmt.format(d), short: monthShort.format(d).toUpperCase() };
}

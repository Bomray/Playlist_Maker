// Histogramme à une seule série, en HTML/CSS (pas de bibliothèque de graphiques).
// Règles appliquées : barres ≤ 24 px, bout arrondi de 4 px, écart de 2 px, une seule
// étiquette directe (le maximum), info-bulle au survol et au focus clavier, tableau
// pour les lecteurs d'écran.
import { formatHours, formatInt } from "./format";

export interface Column {
  key: string;
  /** Libellé complet (info-bulle, tableau). */
  label: string;
  /** Étiquette d'axe, `null` pour ne pas en afficher (axes chargés : 24 h, mois). */
  axisLabel: string | null;
  msPlayed: number;
  plays: number;
}

interface Props {
  title: string;
  columns: Column[];
}

export function ColumnChart({ title, columns }: Props) {
  const max = Math.max(1, ...columns.map((c) => c.msPlayed));
  const peak = columns.reduce<Column | null>(
    (best, c) => (!best || c.msPlayed > best.msPlayed ? c : best),
    null,
  );

  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="text-sm font-semibold">{title}</figcaption>
      {/* Le graphique est décoratif pour les lecteurs d'écran : le tableau ci-dessous le remplace. */}
      <div aria-hidden className="relative pt-5">
        <div className="flex h-36 items-end gap-[2px] border-b border-border">
          {columns.map((c) => {
            const height = (c.msPlayed / max) * 100;
            return (
              <div
                key={c.key}
                className="group relative flex h-full min-w-0 flex-1 items-end justify-center"
              >
                {c === peak && c.msPlayed > 0 && (
                  <span
                    className="absolute text-[0.7rem] whitespace-nowrap text-muted-foreground"
                    style={{ bottom: `calc(${height}% + 2px)` }}
                  >
                    {formatHours(c.msPlayed)}
                  </span>
                )}
                <div
                  className="w-full max-w-6 rounded-t-[4px] bg-viz-series transition-opacity group-hover:opacity-80"
                  style={{ height: `${height}%`, minHeight: c.msPlayed > 0 ? 2 : 0 }}
                />
                {/* Info-bulle : zone de survol = toute la colonne, plus large que la barre. */}
                <div className="pointer-events-none absolute bottom-full z-10 mb-1 hidden w-max rounded-md border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-sm group-hover:block">
                  <span className="font-medium">{c.label}</span>
                  <br />
                  {formatHours(c.msPlayed)} · {formatInt(c.plays)} écoutes
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-1 flex gap-[2px] text-[0.65rem] text-muted-foreground">
          {columns.map((c) => (
            <span
              key={c.key}
              className="min-w-0 flex-1 overflow-visible text-center whitespace-nowrap"
            >
              {c.axisLabel ?? ""}
            </span>
          ))}
        </div>
      </div>
      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">Période</th>
            <th scope="col">Temps d&apos;écoute</th>
            <th scope="col">Écoutes</th>
          </tr>
        </thead>
        <tbody>
          {columns.map((c) => (
            <tr key={c.key}>
              <th scope="row">{c.label}</th>
              <td>{formatHours(c.msPlayed)}</td>
              <td>{formatInt(c.plays)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

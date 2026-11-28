// Barre de progression aux couleurs du thème. Le <progress> natif ignore accent-color dans
// Chrome (barre verte) : on garde son rôle et ses valeurs pour les lecteurs d'écran.
import { cn } from "cn";

interface Props {
  /** `undefined` : durée inconnue (barre animée, sans valeur). */
  value?: number;
  max?: number;
  label: string;
  className?: string;
}

export function ProgressBar({ value, max, label, className }: Props) {
  const known = value !== undefined && max !== undefined && max > 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={known ? 0 : undefined}
      aria-valuemax={known ? max : undefined}
      aria-valuenow={known ? value : undefined}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}
    >
      <div
        className={cn(
          "h-full rounded-full bg-primary transition-[width] duration-300",
          !known && "w-1/3 animate-pulse",
        )}
        style={known ? { width: `${Math.min(100, (value / max) * 100)}%` } : undefined}
      />
    </div>
  );
}

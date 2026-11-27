import { Button } from "@/components/ui/button";
import { providerLabel } from "./format";

interface Props {
  playlistName: string | null;
  source: string | null;
  done: number;
  total: number | null;
  onCancel: () => void;
}

/** Étape 2 : progression de la recherche, titre par titre. */
export function ProgressPanel({ playlistName, source, done, total, onCancel }: Props) {
  const label =
    total === null
      ? "Lecture de la playlist…"
      : `Recherche sur Spotify : ${done} / ${total} titre${total > 1 ? "s" : ""}`;

  return (
    <section aria-labelledby="progress-title" className="flex flex-col gap-3">
      <h2 id="progress-title" className="text-lg font-semibold">
        {playlistName ? `« ${playlistName} »` : "Conversion en cours"}
        {source && (
          <span className="font-normal text-muted-foreground"> depuis {providerLabel(source)}</span>
        )}
      </h2>
      {/* Sans valeur, <progress> s'affiche en mode « indéterminé » (durée inconnue). */}
      <progress
        className="h-2 w-full overflow-hidden rounded-full accent-primary"
        max={total ?? undefined}
        value={total === null ? undefined : done}
        aria-label="Progression de la conversion"
      />
      {/* aria-live : annoncé aux lecteurs d'écran sans voler le focus. */}
      <p aria-live="polite" className="text-sm text-muted-foreground">
        {label}
      </p>
      <Button variant="outline" onClick={onCancel} className="self-start">
        Annuler
      </Button>
    </section>
  );
}

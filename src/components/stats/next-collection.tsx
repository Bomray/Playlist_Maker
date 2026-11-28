"use client";
// Minuteur avant le prochain relevé automatique (GitHub Actions, minute 17 de chaque heure).
// Juste après l'heure prévue, tant que le relevé n'est pas arrivé, on l'attend et on recharge
// les stats dès qu'il a ajouté des écoutes.
import { Timer } from "lucide-react";
import { useEffect, useState } from "react";
import { formatCountdown, nextCollection } from "@/core/stats";

const HOUR_MS = 3_600_000;
/** GitHub lance parfois les tâches planifiées avec plusieurs minutes de retard. */
const GRACE_MS = 15 * 60_000;
const timeFmt = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });

interface Props {
  lastCollectedAt: number | null;
  /** Interroge le serveur : appelé chaque minute pendant l'attente d'un relevé en retard. */
  onPoll: () => void;
}

export function NextCollection({ lastCollectedAt, onPoll }: Props) {
  // `null` avant l'hydratation : l'heure du serveur n'est pas celle du navigateur.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const next = now === null ? null : nextCollection(now);
  const previous = next === null ? null : next - HOUR_MS;
  const waiting =
    now !== null &&
    previous !== null &&
    now - previous < GRACE_MS &&
    (lastCollectedAt ?? 0) < previous;

  useEffect(() => {
    if (!waiting) return;
    const id = setInterval(onPoll, 60_000);
    return () => clearInterval(id);
  }, [waiting, onPoll]);

  if (now === null || next === null) return null;

  return (
    <p className="flex items-center gap-2 text-sm">
      <Timer className="size-4 shrink-0 text-primary" aria-hidden />
      {waiting ? (
        <span>Relevé en cours… (GitHub a parfois quelques minutes de retard)</span>
      ) : (
        <span>
          Prochain relevé vers {timeFmt.format(next)}, dans{" "}
          {/* Pas d'annonce à chaque seconde pour les lecteurs d'écran. */}
          <span className="font-semibold tabular-nums">{formatCountdown(next - now)}</span>
        </span>
      )}
    </p>
  );
}

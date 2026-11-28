"use client";
// Préférence minutes / heures partagée par toute la page et mémorisée dans le navigateur.
import { useCallback, useSyncExternalStore } from "react";
import { Segmented } from "./segmented";
import { DURATION_STORAGE_KEY, type DurationUnit, parseDurationUnit } from "./duration";

const listeners = new Set<() => void>();
// Valeur choisie pendant la visite, utilisée si le stockage du navigateur est indisponible.
let memory: DurationUnit = "minutes";

function read(): DurationUnit {
  try {
    return parseDurationUnit(localStorage.getItem(DURATION_STORAGE_KEY));
  } catch {
    // Stockage bloqué (navigation privée stricte).
    return memory;
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export function useDurationUnit(): [DurationUnit, (unit: DurationUnit) => void] {
  // Côté serveur : minutes (la préférence n'est connue qu'une fois dans le navigateur).
  const unit = useSyncExternalStore(subscribe, read, () => "minutes" as const);
  const setUnit = useCallback((next: DurationUnit) => {
    memory = next;
    try {
      localStorage.setItem(DURATION_STORAGE_KEY, next);
    } catch {
      // Préférence non mémorisée : elle s'applique quand même jusqu'au rechargement.
    }
    listeners.forEach((l) => l());
  }, []);
  return [unit, setUnit];
}

const OPTIONS = [
  { value: "minutes", label: "Minutes" },
  { value: "hours", label: "Heures" },
] as const;

/** Bascule « Minutes / Heures », à placer à côté de chaque durée affichée. */
export function DurationToggle({ className }: { className?: string }) {
  const [unit, setUnit] = useDurationUnit();
  return (
    <Segmented
      label="Unité des durées"
      value={unit}
      options={OPTIONS}
      onChange={setUnit}
      className={className}
    />
  );
}

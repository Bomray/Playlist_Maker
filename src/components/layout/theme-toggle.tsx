"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import {
  THEME_STORAGE_KEY,
  type ThemePreference,
  nextThemePreference,
  parseThemePreference,
  resolveDark,
} from "@/lib/theme";

const LABELS: Record<ThemePreference, string> = {
  system: "Thème du système",
  dark: "Thème sombre",
  light: "Thème clair",
};

const ICONS = { system: Monitor, dark: Moon, light: Sun } as const;

function readStored(): ThemePreference {
  try {
    return parseThemePreference(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    // Stockage inaccessible (navigation privée stricte) : on suit le système.
    return "system";
  }
}

function apply(preference: ThemePreference) {
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.classList.toggle("dark", resolveDark(preference, systemDark));
}

/** Bouton qui passe du thème du système au sombre puis au clair. */
export function ThemeToggle() {
  // « système » au premier rendu (identique côté serveur) ; la vraie valeur arrive juste après.
  const [preference, setPreference] = useState<ThemePreference>("system");

  useEffect(() => {
    const stored = readStored();
    // Synchronisation avec une source extérieure (le stockage du navigateur) au montage.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPreference(stored);
    if (stored !== "system") return;
    // En mode système, suivre les changements faits pendant que la page est ouverte.
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [preference]);

  function cycle() {
    const next = nextThemePreference(preference);
    setPreference(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Sans stockage, le choix vaut pour cette page seulement.
    }
    apply(next);
  }

  const Icon = ICONS[preference];
  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={`${LABELS[preference]} (changer)`}
      title={LABELS[preference]}
      className="flex size-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <Icon className="size-5" aria-hidden />
    </button>
  );
}

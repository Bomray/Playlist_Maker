/**
 * Préférence de thème (clair, sombre ou système), enregistrée dans le navigateur.
 *
 * Le script de démarrage (`THEME_SCRIPT`) s'exécute dans <head> avant l'affichage : il pose
 * la classe `dark` sur <html> sans attendre React, pour éviter un flash de thème clair.
 */

export type ThemePreference = "system" | "light" | "dark";

export const THEME_STORAGE_KEY = "wavl-theme";

const ORDER: readonly ThemePreference[] = ["system", "dark", "light"];

export function parseThemePreference(value: unknown): ThemePreference {
  return value === "light" || value === "dark" ? value : "system";
}

/** Préférence suivante quand on clique sur le bouton de thème : système → sombre → clair. */
export function nextThemePreference(current: ThemePreference): ThemePreference {
  return ORDER[(ORDER.indexOf(current) + 1) % ORDER.length] ?? "system";
}

export function resolveDark(preference: ThemePreference, systemPrefersDark: boolean): boolean {
  return preference === "dark" || (preference === "system" && systemPrefersDark);
}

// Volontairement minimal et autonome (pas d'import possible ici) ; même logique que
// parseThemePreference + resolveDark. Un stockage inaccessible (navigation privée stricte)
// revient au thème du système.
export const THEME_SCRIPT = `(function(){try{var p=localStorage.getItem("${THEME_STORAGE_KEY}");}catch(e){}var d=p==="dark"||(p!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);})();`;

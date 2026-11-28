// Dégradé de remplacement quand une pochette manque : teinte stable tirée du nom.

/** Teinte stable dérivée du nom, autour du violet parme (pour varier sans jurer). */
export function hue(name: string): number {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return 230 + (h % 110); // de bleu à rose
}

export function gradientFor(name: string): string {
  const h = hue(name);
  return `linear-gradient(135deg, oklch(0.62 0.16 ${h}), oklch(0.32 0.12 ${h + 30}))`;
}

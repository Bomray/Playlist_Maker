import { useId } from "react";
import { cn } from "cn";

// Cassure en forme d'onde (le W de Wavl) qui sépare le disque en deux moitiés.
const TOP_HALF =
  "M-10 -10 H130 V44 C116 44 104 84 89 84 C76 84 72 50 60 50 C48 50 44 84 31 84 C16 84 4 44 -10 44Z";
const BOTTOM_HALF =
  "M-10 44 C4 44 16 84 31 84 C44 84 48 50 60 50 C72 50 76 84 89 84 C104 84 116 44 130 44 V130 H-10Z";

type LogoProps = {
  className?: string;
  /** Anime l'écartement des deux moitiés à l'affichage (désactivé si l'utilisateur réduit les animations). */
  animated?: boolean;
  /** Texte alternatif ; vide quand le logo accompagne déjà le nom « Wavl ». */
  title?: string;
};

/** Logo Wavl : un vinyle fendu par une onde dont la cassure dessine un W. */
export function Logo({ className, animated = false, title }: LogoProps) {
  // Identifiants uniques : plusieurs logos peuvent cohabiter sur une même page.
  const id = useId().replace(/:/g, "");
  const light = `${id}-light`;
  const deep = `${id}-deep`;
  const hole = `${id}-hole`;

  const half = (
    clip: string,
    fill: string,
    label: string,
    grooveColor: string,
    opacity: number,
  ) => (
    <g clipPath={`url(#${clip})`} mask={`url(#${hole})`}>
      <circle cx="60" cy="60" r="54" fill={`url(#${fill})`} />
      <g fill="none" stroke={grooveColor} strokeOpacity={opacity} strokeWidth="2">
        <circle cx="60" cy="60" r="42" />
        <circle cx="60" cy="60" r="31" />
      </g>
      <circle cx="60" cy="60" r="16" fill={`url(#${label})`} />
    </g>
  );

  return (
    <svg
      viewBox="-10 -10 140 140"
      className={cn("shrink-0", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <defs>
        <linearGradient id={light} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fdf7ff" />
          <stop offset=".6" stopColor="#e2c9f7" />
          <stop offset="1" stopColor="#c4a0ee" />
        </linearGradient>
        <linearGradient id={deep} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#b08ae4" />
          <stop offset="1" stopColor="#6c48ad" />
        </linearGradient>
        <clipPath id={`${id}-top`}>
          <path d={TOP_HALF} />
        </clipPath>
        <clipPath id={`${id}-bottom`}>
          <path d={BOTTOM_HALF} />
        </clipPath>
        <mask id={hole}>
          <rect x="-20" y="-20" width="160" height="160" fill="#fff" />
          <circle cx="60" cy="60" r="5" fill="#000" />
        </mask>
      </defs>
      <g
        className={animated ? "logo-top" : undefined}
        transform={animated ? undefined : "translate(0 -6)"}
      >
        {half(`${id}-top`, light, deep, "#2a1a44", 0.14)}
      </g>
      <g
        className={animated ? "logo-bottom" : undefined}
        transform={animated ? undefined : "translate(0 6)"}
      >
        {half(`${id}-bottom`, deep, light, "#000", 0.2)}
      </g>
    </svg>
  );
}

/** Logo suivi du nom, pour l'en-tête. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <Logo className="size-8" animated />
      <span className="font-heading text-xl font-bold tracking-tight">wavl</span>
    </span>
  );
}

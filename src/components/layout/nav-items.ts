import { ArrowLeftRight, ChartNoAxesColumn, type LucideIcon } from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };

/** Sections de l'appli (les tops complets et les notes s'ajouteront ici). */
export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", label: "Stats", icon: ChartNoAxesColumn },
  { href: "/convertir", label: "Convertir", icon: ArrowLeftRight },
];

/** Une section est active sur sa page et ses sous-pages (« / » seulement sur l'accueil). */
export function isActive(href: string, pathname: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

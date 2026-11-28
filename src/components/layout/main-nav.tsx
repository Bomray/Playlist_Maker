"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";
import { NAV_ITEMS, isActive } from "./nav-items";

/** Navigation de l'en-tête (écrans larges) : pastilles dans la barre du haut. */
export function MainNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Navigation principale" className="hidden items-center gap-1 md:flex">
      {NAV_ITEMS.map((item) => {
        const active = isActive(item.href, pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Navigation du bas (téléphone) : barre flottante, toujours à portée du pouce. */
export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Navigation principale"
      className="header-glass fixed inset-x-4 bottom-4 z-40 flex items-center gap-1 rounded-full p-1.5 md:hidden"
    >
      {NAV_ITEMS.map((item) => {
        const active = isActive(item.href, pathname);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-12 flex-1 items-center justify-center gap-2 rounded-full text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              active ? "bg-primary text-primary-foreground" : "text-muted-foreground",
            )}
          >
            <Icon className="size-5" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

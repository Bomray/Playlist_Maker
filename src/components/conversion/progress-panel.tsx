"use client";
// Étape 2 : progression de la recherche. Chaque titre est une carte qui montre la pochette
// d'origine, puis se retourne sur celle trouvée sur Spotify (ou un statut) une fois traité.
import { Check, HelpCircle, X } from "lucide-react";
import { gradientFor } from "@/components/brand/gradient";
import { Button } from "@/components/ui/button";
import type { ProgressItem, TrackPreview } from "@/lib/conversion-stream";
import { providerLabel } from "./format";
import { ProgressBar } from "@/components/layout/progress-bar";

/** Au-delà, les cartes ne disent plus grand-chose : on affiche le compte des autres. */
const MAX_CARDS = 120;

interface Props {
  playlistName: string | null;
  source: string | null;
  done: number;
  total: number | null;
  tracks: TrackPreview[];
  items: ProgressItem[];
  onCancel: () => void;
}

function Face({ url, name, back = false }: { url?: string; name: string; back?: boolean }) {
  return (
    <span
      className={`absolute inset-0 overflow-hidden rounded-xl [backface-visibility:hidden] ${back ? "[transform:rotateY(180deg)]" : ""}`}
      style={{ background: gradientFor(name) }}
    >
      {url && (
        // Petites pochettes des CDN des plateformes : pas d'optimiseur d'images.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className="size-full object-cover"
        />
      )}
    </span>
  );
}

const BADGE = {
  found: { icon: Check, className: "bg-emerald-500 text-white" },
  manual: { icon: Check, className: "bg-emerald-500 text-white" },
  uncertain: { icon: HelpCircle, className: "bg-amber-400 text-amber-950" },
  not_found: { icon: X, className: "bg-muted-foreground text-background" },
} as const;

function Card({ track, item }: { track: TrackPreview; item: ProgressItem | undefined }) {
  const badge = item && BADGE[item.status];
  return (
    <li
      className="relative aspect-square [perspective:600px]"
      title={`${track.title} — ${track.artist}`}
    >
      <span
        className={`absolute inset-0 transition-transform duration-700 [transform-style:preserve-3d] motion-reduce:transition-none ${item ? "[transform:rotateY(180deg)]" : ""}`}
      >
        <Face url={track.artworkUrl} name={track.title} />
        <Face url={item?.artworkUrl} name={track.title} back />
      </span>
      {badge && (
        <span
          className={`absolute -right-1 -bottom-1 grid size-5 place-items-center rounded-full shadow ring-2 ring-background ${badge.className}`}
        >
          <badge.icon className="size-3" aria-hidden />
        </span>
      )}
      {item?.status === "not_found" && (
        <span className="absolute inset-0 rounded-xl bg-background/50" aria-hidden />
      )}
    </li>
  );
}

export function ProgressPanel({
  playlistName,
  source,
  done,
  total,
  tracks,
  items,
  onCancel,
}: Props) {
  const label =
    total === null
      ? "Lecture de la playlist…"
      : `Recherche sur Spotify : ${done} / ${total} titre${total > 1 ? "s" : ""}`;
  const found = items.filter((i) => i?.status === "found" || i?.status === "manual").length;
  const shown = tracks.slice(0, MAX_CARDS);

  return (
    <section
      aria-labelledby="progress-title"
      className="glass flex flex-col gap-4 rounded-3xl p-4 sm:p-6"
    >
      <h2 id="progress-title" className="text-lg font-semibold">
        {playlistName ? `« ${playlistName} »` : "Conversion en cours"}
        {source && (
          <span className="font-normal text-muted-foreground"> depuis {providerLabel(source)}</span>
        )}
      </h2>
      <ProgressBar
        max={total ?? undefined}
        value={total === null ? undefined : done}
        label="Progression de la conversion"
      />
      {/* aria-live : annoncé aux lecteurs d'écran sans voler le focus. */}
      <p aria-live="polite" className="text-sm text-muted-foreground">
        {label}
        {done > 0 && ` · ${found} trouvé${found > 1 ? "s" : ""}`}
      </p>
      {shown.length > 0 && (
        // Décoratif : la progression est annoncée par le texte ci-dessus.
        <ul
          aria-hidden
          className="grid grid-cols-[repeat(auto-fill,minmax(3.5rem,1fr))] gap-2 sm:grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))]"
        >
          {shown.map((t, i) => (
            <Card key={i} track={t} item={items[i]} />
          ))}
          {tracks.length > MAX_CARDS && (
            <li className="grid aspect-square place-items-center rounded-xl bg-muted text-sm text-muted-foreground">
              +{tracks.length - MAX_CARDS}
            </li>
          )}
        </ul>
      )}
      <Button variant="outline" onClick={onCancel} className="self-start">
        Annuler
      </Button>
    </section>
  );
}

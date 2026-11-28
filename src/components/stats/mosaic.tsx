"use client";
// Mosaïque des n°1 de la période : artiste, titre, album, puis les artistes suivants.
// En attendant les pochettes (PR suivante), chaque case a un dégradé propre à son nom.
import { cn } from "cn";
import type { Stats, TopEntry } from "@/core/stats";
import { formatDuration } from "./duration";
import { formatInt } from "./format";
import { useDurationUnit } from "./use-duration-unit";

/** Teinte stable dérivée du nom, autour du violet parme (pour varier sans jurer). */
function hue(name: string): number {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return 230 + (h % 110); // de bleu à rose
}

function initials(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N} ]/gu, "")
    .split(/\s+/)
    .filter(Boolean);
  return (
    words.length > 1 ? words[0]![0]! + words[1]![0]! : (words[0] ?? "?").slice(0, 2)
  ).toUpperCase();
}

interface TileProps {
  entry: TopEntry;
  caption: string;
  large?: boolean;
  className?: string;
}

function Tile({ entry, caption, large, className }: TileProps) {
  const [unit] = useDurationUnit();
  const h = hue(entry.label);
  return (
    <li
      className={cn(
        "group relative isolate flex min-h-32 flex-col justify-end overflow-hidden rounded-3xl p-3 text-white sm:p-4",
        className,
      )}
      style={{
        background: `linear-gradient(135deg, oklch(0.62 0.16 ${h}), oklch(0.32 0.12 ${h + 30}))`,
      }}
    >
      <span
        aria-hidden
        className={cn(
          "absolute -top-2 -right-1 -z-10 font-heading font-bold text-white/15 transition-transform duration-500 group-hover:scale-110 motion-reduce:transition-none",
          large ? "text-9xl" : "text-6xl",
        )}
      >
        {initials(entry.label)}
      </span>
      {/* Voile pour garder le texte lisible quelle que soit la teinte. */}
      <span
        aria-hidden
        className="absolute inset-0 -z-10 bg-gradient-to-t from-black/55 to-transparent"
      />
      <span className="text-xs font-medium tracking-wide text-white/80 uppercase">{caption}</span>
      <span
        className={cn(
          "font-heading font-bold break-words",
          large ? "text-2xl sm:text-3xl" : "text-base",
        )}
      >
        {entry.label}
      </span>
      {entry.sublabel && <span className="truncate text-sm text-white/80">{entry.sublabel}</span>}
      <span className="mt-1 text-xs text-white/80 tabular-nums">
        {formatDuration(entry.msPlayed, unit)} · {formatInt(entry.plays)} écoute
        {entry.plays > 1 ? "s" : ""}
      </span>
    </li>
  );
}

const byTime = (list: TopEntry[]) => [...list].sort((a, b) => b.msPlayed - a.msPlayed);

export function Mosaic({ stats }: { stats: Stats }) {
  const artists = byTime(stats.topArtists);
  const track = byTime(stats.topTracks)[0];
  const album = byTime(stats.topAlbums)[0];
  if (!artists[0]) return null;

  return (
    <section aria-label="Tes n°1 de la période">
      <ul className="grid auto-rows-[minmax(8rem,auto)] grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile
          entry={artists[0]}
          caption="Artiste n°1"
          large
          className="col-span-2 row-span-2 min-h-64"
        />
        {track && <Tile entry={track} caption="Titre n°1" />}
        {album && <Tile entry={album} caption="Album n°1" />}
        {artists.slice(1, 3).map((a, i) => (
          <Tile key={a.key} entry={a} caption={`Artiste n°${i + 2}`} />
        ))}
      </ul>
    </section>
  );
}

"use client";
// Pochettes et photos d'artistes des entrées affichées, lues dans le cache en base (comptes
// connectés). En attendant (ou sans image connue), un dégradé propre à chaque nom.
import { createContext, type ReactNode, useContext, useEffect, useState } from "react";
import { cn } from "cn";
import type { Stats, TopEntry } from "@/core/stats";
import type { ImageMap } from "@/lib/db/images";

export type ImageKind = "track" | "artist" | "album";

const EMPTY: ImageMap = { tracks: {}, artists: {}, albums: {} };
const ImagesContext = createContext<ImageMap>(EMPTY);

/** Clé « artiste \0 album » des tops → artiste et album séparés. */
function splitKey(key: string): [string, string] {
  const i = key.indexOf("\u0000");
  return i < 0 ? ["", key] : [key.slice(0, i), key.slice(i + 1)];
}

export function ImagesProvider({
  stats,
  enabled,
  children,
}: {
  stats: Stats | null;
  enabled: boolean;
  children: ReactNode;
}) {
  const [images, setImages] = useState<ImageMap>(EMPTY);

  useEffect(() => {
    if (!enabled || !stats) return;
    const controller = new AbortController();
    const body = {
      tracks: stats.topTracks.map((t) => ({
        key: t.key,
        artist: t.sublabel ?? "",
        title: t.label,
      })),
      artists: stats.topArtists.map((a) => a.label),
      albums: stats.topAlbums.map((a) => {
        const [artist, album] = splitKey(a.key);
        return { key: a.key, artist, album };
      }),
    };
    fetch("/api/stats/images", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
      .then((res) => (res.ok ? (res.json() as Promise<ImageMap>) : null))
      .then((map) => {
        // On garde les images déjà connues : changer de période ne fait pas clignoter.
        if (map)
          setImages((prev) => ({
            tracks: { ...prev.tracks, ...map.tracks },
            artists: { ...prev.artists, ...map.artists },
            albums: { ...prev.albums, ...map.albums },
          }));
      })
      .catch((e: unknown) => {
        // Images facultatives : un échec laisse simplement les dégradés.
        if (!(e instanceof DOMException && e.name === "AbortError"))
          console.warn("Images indisponibles", e);
      });
    return () => controller.abort();
  }, [stats, enabled]);

  return <ImagesContext.Provider value={images}>{children}</ImagesContext.Provider>;
}

export function useImage(kind: ImageKind, entry: TopEntry): string | null {
  const images = useContext(ImagesContext);
  if (kind === "track") return images.tracks[entry.key] ?? null;
  if (kind === "artist") return images.artists[entry.label] ?? null;
  return images.albums[entry.key] ?? null;
}

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

/**
 * Image de fond (pochette ou photo) qui apparaît en fondu une fois chargée, par-dessus le
 * dégradé. Décorative : le nom est toujours écrit à côté.
 */
export function Artwork({
  src,
  className,
  round = false,
}: {
  src: string | null;
  className?: string;
  round?: boolean;
}) {
  const [loaded, setLoaded] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  if (!src || failed === src) return null;
  // Images du CDN de Spotify, déjà aux bonnes tailles : pas besoin de l'optimiseur de Next.js
  // (qui consommerait le quota d'optimisation d'images de Vercel).
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      aria-hidden
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onLoad={() => setLoaded(src)}
      onError={() => setFailed(src)}
      className={cn(
        "absolute inset-0 size-full object-cover transition-opacity duration-500 motion-reduce:transition-none",
        loaded === src ? "opacity-100" : "opacity-0",
        round && "rounded-full",
        className,
      )}
    />
  );
}

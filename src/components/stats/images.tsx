"use client";
// Pochettes et photos d'artistes des entrées affichées, lues dans le cache en base (comptes
// connectés). En attendant (ou sans image connue), un dégradé propre à chaque nom.
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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

/** Entrées dont on veut les images : tops d'une page, ou page de tops complets déjà chargée. */
export type ImageSources = Pick<Stats, "topTracks" | "topArtists" | "topAlbums">;

/** Limite de la route par liste et par requête. */
const CHUNK = 300;

async function fetchImages(body: {
  tracks: { key: string; artist: string; title: string }[];
  artists: string[];
  albums: { key: string; artist: string; album: string }[];
}): Promise<ImageMap | null> {
  const res = await fetch("/api/stats/images", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.ok ? ((await res.json()) as ImageMap) : null;
}

export function ImagesProvider({
  stats,
  enabled,
  children,
}: {
  /** Les fournisseurs s'imbriquent : une page de détail ajoute ses images à celles de la page. */
  stats: ImageSources | null;
  enabled: boolean;
  children: ReactNode;
}) {
  const images = useContext(ImagesContext);
  const [own, setImages] = useState<ImageMap>(EMPTY);
  // Entrées déjà demandées : changer de période ou charger la suite ne redemande que les nouvelles.
  const requested = useRef(new Set<string>());

  useEffect(() => {
    if (!enabled || !stats) return;
    const fresh = <T,>(list: T[], id: (x: T) => string) =>
      list.filter((x) => {
        const k = id(x);
        if (requested.current.has(k)) return false;
        requested.current.add(k);
        return true;
      });
    const tracks = fresh(stats.topTracks, (t) => `t:${t.key}`).map((t) => ({
      key: t.key,
      artist: t.sublabel ?? "",
      title: t.label,
    }));
    const artists = fresh(stats.topArtists, (a) => `a:${a.label}`).map((a) => a.label);
    const albums = fresh(stats.topAlbums, (a) => `l:${a.key}`).map((a) => {
      const [artist, album] = splitKey(a.key);
      return { key: a.key, artist, album };
    });

    const rounds = Math.ceil(Math.max(tracks.length, artists.length, albums.length) / CHUNK);
    for (let i = 0; i < rounds; i++) {
      const part = <T,>(list: T[]) => list.slice(i * CHUNK, (i + 1) * CHUNK);
      fetchImages({
        tracks: part(tracks),
        artists: part(artists),
        albums: part(albums),
      })
        .then((map) => {
          if (!map) return;
          setImages((prev) => ({
            tracks: { ...prev.tracks, ...map.tracks },
            artists: { ...prev.artists, ...map.artists },
            albums: { ...prev.albums, ...map.albums },
          }));
        })
        // Images facultatives : un échec laisse simplement les dégradés.
        .catch((e: unknown) => console.warn("Images indisponibles", e));
    }
  }, [stats, enabled]);

  // Imbricable : la page de détail ajoute ses images à celles de la page.
  const value = useMemo(
    () => ({
      tracks: { ...images.tracks, ...own.tracks },
      artists: { ...images.artists, ...own.artists },
      albums: { ...images.albums, ...own.albums },
    }),
    [images, own],
  );
  return <ImagesContext.Provider value={value}>{children}</ImagesContext.Provider>;
}

export function useImage(kind: ImageKind, entry: TopEntry): string | null {
  const images = useContext(ImagesContext);
  if (kind === "track") return images.tracks[entry.key] ?? null;
  if (kind === "artist") return images.artists[entry.label] ?? null;
  return images.albums[entry.key] ?? null;
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

"use client";
// Tous les tops de la période : onglets titres / artistes / albums, recherche, tri, et
// chargement de la suite au défilement (le classement complet reste dans le worker).
import { ArrowLeft, Search } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { type Period, periodLabel, type RankedEntry, type TopMetric } from "@/core/stats";
import { formatDuration } from "./duration";
import { formatInt } from "./format";
import { type ImageSources, ImagesProvider } from "./images";
import { Segmented } from "./segmented";
import {
  closeSelection,
  entrySelection,
  SelectionLink,
  TOPS_TABS,
  type TopsTab,
} from "./selection-link";
import { IMAGE_KIND, Thumb } from "./top-list";
import { DurationToggle, useDurationUnit } from "./use-duration-unit";
import type { TopsPage, TopsQuery } from "./use-stats";

const PAGE = 50;
const METRICS = [
  { value: "plays", label: "Écoutes" },
  { value: "msPlayed", label: "Temps" },
] as const;
const NOUN = { titres: "titres", artistes: "artistes", albums: "albums" } as const;
const ONE = { titres: "titre", artistes: "artiste", albums: "album" } as const;

interface Props {
  tab: TopsTab;
  period: Period;
  loggedIn: boolean;
  /** Change dès que les écoutes ou la période changent : la liste repart du début. */
  version: unknown;
  requestTops: (q: TopsQuery) => Promise<TopsPage>;
}

export function TopsView({ tab, period, loggedIn, version, requestTops }: Props) {
  const searchId = useId();
  const [unit] = useDurationUnit();
  const [metric, setMetric] = useState<TopMetric>("plays");
  const [query, setQuery] = useState("");
  const [list, setList] = useState<{ entries: RankedEntry[]; total: number } | null>(null);
  const loading = useRef(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const kind = TOPS_TABS.find((t) => t.value === tab)!.kind;

  // Nouvelle recherche (onglet, tri, texte, période) : première page.
  useEffect(() => {
    let alive = true;
    requestTops({ kind, metric, query, offset: 0, limit: PAGE }).then((page) => {
      if (alive) setList({ entries: page.entries, total: page.total });
    });
    return () => {
      alive = false;
    };
  }, [kind, metric, query, version, requestTops]);

  const loadMore = useCallback(() => {
    if (!list || loading.current || list.entries.length >= list.total) return;
    loading.current = true;
    requestTops({ kind, metric, query, offset: list.entries.length, limit: PAGE })
      .then((page) =>
        setList((l) => (l ? { entries: [...l.entries, ...page.entries], total: page.total } : l)),
      )
      .finally(() => {
        loading.current = false;
      });
  }, [list, kind, metric, query, requestTops]);

  // Suite chargée quand le bas de la liste approche de l'écran.
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => entries[0]?.isIntersecting && loadMore(),
      {
        rootMargin: "600px",
      },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  const shown = useMemo(() => list?.entries ?? [], [list]);
  const sources = useMemo<ImageSources>(
    () => ({
      topTracks: kind === "topTracks" ? shown : [],
      topArtists: kind === "topArtists" ? shown : [],
      topAlbums: kind === "topAlbums" ? shown : [],
    }),
    [kind, shown],
  );
  const imageKind = IMAGE_KIND[kind];

  return (
    <div className="flex flex-col gap-6">
      <button
        type="button"
        onClick={closeSelection}
        className="flex items-center gap-2 self-start rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Toutes mes stats
      </button>

      <section
        aria-labelledby="tops-title"
        className="glass flex flex-col gap-4 rounded-3xl p-4 sm:p-6"
      >
        <h2 id="tops-title" className="font-heading text-2xl font-bold">
          Tous les tops <span className="text-muted-foreground">{periodLabel(period)}</span>
        </h2>
        <div role="tablist" aria-label="Classement" className="flex gap-1">
          {TOPS_TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={t.value === tab}
              onClick={() => window.history.replaceState(null, "", `/?tops=${t.value}`)}
              className={`h-9 rounded-full px-4 text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none ${t.value === tab ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor={searchId} className="sr-only">
            Rechercher dans les {NOUN[tab]}
          </label>
          <div className="relative min-w-0 flex-1 basis-56">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              id={searchId}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Rechercher (${NOUN[tab]}, artiste…)`}
              className="h-10 w-full rounded-full border border-input bg-background/60 pr-3 pl-9 text-sm focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            />
          </div>
          <Segmented label="Trier par" value={metric} options={METRICS} onChange={setMetric} />
          <DurationToggle />
        </div>
        <p aria-live="polite" className="text-sm text-muted-foreground">
          {list === null
            ? "Chargement…"
            : list.total === 1
              ? `1 ${ONE[tab]}${query ? " trouvé" : ""}`
              : `${formatInt(list.total)} ${NOUN[tab]}${query ? " trouvés" : ""}`}
        </p>

        <ImagesProvider stats={sources} enabled={loggedIn}>
          <ol className="flex flex-col gap-1">
            {shown.map((e) => (
              <li
                key={e.key}
                className="flex items-center gap-3 rounded-2xl px-1 py-1.5 hover:bg-accent/40"
              >
                <span className="w-7 shrink-0 text-right text-sm text-muted-foreground tabular-nums sm:w-10">
                  {e.rank}
                </span>
                <Thumb entry={e} kind={imageKind} />
                <span className="min-w-0 flex-1 text-sm break-words">
                  <SelectionLink
                    selection={entrySelection(imageKind, e)}
                    className="font-medium underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
                  >
                    {e.label}
                  </SelectionLink>
                  {e.sublabel && <span className="block text-muted-foreground">{e.sublabel}</span>}
                </span>
                <span className="shrink-0 text-right text-sm tabular-nums">
                  <span className="block font-medium">
                    {metric === "plays"
                      ? `${formatInt(e.plays)} écoutes`
                      : formatDuration(e.msPlayed, unit)}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {metric === "plays"
                      ? formatDuration(e.msPlayed, unit)
                      : `${formatInt(e.plays)} écoutes`}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </ImagesProvider>
        <div ref={sentinel} aria-hidden />
        {list && list.entries.length < list.total && (
          // Repli si le défilement automatique ne se déclenche pas (et pour le clavier).
          <button
            type="button"
            onClick={loadMore}
            className="self-center rounded-full px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            Afficher la suite
          </button>
        )}
      </section>
    </div>
  );
}

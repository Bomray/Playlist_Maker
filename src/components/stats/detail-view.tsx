"use client";
// Page d'un artiste, d'un album ou d'un titre : temps d'écoute, rang, évolution (courbe et
// calendrier jour par jour), titres et albums, moments d'écoute. Même période que la page.
import { ArrowLeft } from "lucide-react";
import { type Period, periodLabel, type Selection, selectionKey, type Stats } from "@/core/stats";
import { durationValue, unitLabel } from "./duration";
import { EvolutionCard } from "./evolution-card";
import { formatDate, formatInt } from "./format";
import { Artwork, gradientFor, type ImageKind, ImagesProvider, useImage } from "./images";
import { Moments } from "./stats-dashboard";
import { closeSelection, entrySelection, SelectionLink } from "./selection-link";
import { TopList } from "./top-list";
import { DurationToggle, useDurationUnit } from "./use-duration-unit";

const KIND_LABEL = { artist: "Artiste", album: "Album", track: "Titre" } as const;
const RANK_LABEL = { artist: "artistes", album: "albums", track: "titres" } as const;
const TOP_FIELD = { artist: "topArtists", album: "topAlbums", track: "topTracks" } as const;

function name(s: Selection): string {
  return s.kind === "artist" ? s.artist : s.kind === "album" ? s.album : s.title;
}

/** Rang par temps d'écoute dans les tops de la page (`null` hors des 100 premiers). */
function rank(main: Stats | null, s: Selection): number | null {
  if (!main) return null;
  const sorted = [...main[TOP_FIELD[s.kind]]].sort((a, b) => b.msPlayed - a.msPlayed);
  const i = sorted.findIndex((e) => e.key === selectionKey(s));
  return i < 0 ? null : i + 1;
}

function Header({ selection, stats, main, period }: Props & { stats: Stats }) {
  const [unit] = useDurationUnit();
  const kind: ImageKind = selection.kind;
  const entry = stats[TOP_FIELD[kind]][0];
  const image = useImage(
    kind,
    entry ?? { key: "", label: "", sublabel: null, plays: 0, msPlayed: 0 },
  );
  const position = rank(main, selection);
  const round = kind === "artist";

  return (
    <section
      aria-label="Chiffres clés"
      className="glass flex flex-col gap-6 rounded-3xl p-4 sm:flex-row sm:p-6"
    >
      <div
        aria-hidden
        className={`relative size-36 shrink-0 self-center overflow-hidden shadow-lg sm:size-44 sm:self-start ${round ? "rounded-full" : "rounded-2xl"}`}
        style={{ background: gradientFor(name(selection)) }}
      >
        <Artwork src={image} round={round} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <div className="flex flex-col">
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {KIND_LABEL[kind]}
            {position && ` · n°${position} de tes ${RANK_LABEL[kind]} ${periodLabel(period)}`}
          </span>
          <h2 className="mt-1 font-heading text-3xl font-bold break-words sm:text-4xl">
            {name(selection)}
          </h2>
          {/* Espace franc entre le nom de l'album (ou du titre) et l'artiste. */}
          {selection.kind !== "artist" && (
            <SelectionLink
              selection={{ kind: "artist", artist: selection.artist }}
              className="mt-2 self-start text-lg text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              {selection.artist}
            </SelectionLink>
          )}
        </div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-heading text-4xl font-bold tabular-nums sm:text-5xl">
              {durationValue(stats.music.msPlayed, unit)}
            </span>
            <span className="text-muted-foreground">
              {unitLabel(stats.music.msPlayed, unit)} d&apos;écoute
            </span>
          </p>
          <DurationToggle />
        </div>
        <ul className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <li className="flex flex-col rounded-2xl bg-background/50 px-3 py-2">
            <span className="font-heading text-xl font-semibold tabular-nums">
              {formatInt(stats.music.plays)}
            </span>
            <span className="text-xs text-muted-foreground">écoutes</span>
          </li>
          <li className="flex flex-col rounded-2xl bg-background/50 px-3 py-2">
            <span className="font-heading text-xl font-semibold tabular-nums">
              {formatInt(stats.music.activeDays)}
            </span>
            <span className="text-xs text-muted-foreground">jours d&apos;écoute</span>
          </li>
          {stats.range && (
            <>
              <li className="flex flex-col rounded-2xl bg-background/50 px-3 py-2">
                <span className="font-medium">{formatDate(stats.range.first)}</span>
                <span className="text-xs text-muted-foreground">première écoute</span>
              </li>
              <li className="flex flex-col rounded-2xl bg-background/50 px-3 py-2">
                <span className="font-medium">{formatDate(stats.range.last)}</span>
                <span className="text-xs text-muted-foreground">dernière écoute</span>
              </li>
            </>
          )}
        </ul>
      </div>
    </section>
  );
}

interface Props {
  selection: Selection;
  stats: Stats | null;
  /** Stats de la page, pour le rang. */
  main: Stats | null;
  period: Period;
  loggedIn: boolean;
}

export function DetailView(props: Props) {
  const { selection, stats, period, loggedIn } = props;
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
      {!stats ? (
        <p aria-live="polite" className="text-sm text-muted-foreground">
          Calcul des stats…
        </p>
      ) : (
        <ImagesProvider stats={stats} enabled={loggedIn}>
          <Header {...props} stats={stats} />
          {!stats.range ? (
            <p className="glass rounded-3xl p-6 text-sm text-muted-foreground">
              Aucune écoute {periodLabel(period)}. Choisis une autre période ci-dessus.
            </p>
          ) : (
            <>
              <EvolutionCard stats={stats} period={period} />
              <div className="grid gap-6 lg:grid-cols-2">
                {selection.kind === "artist" && (
                  <TopList
                    stats={stats}
                    kinds={["topTracks", "topAlbums"]}
                    title="Ses titres et albums"
                  />
                )}
                {selection.kind === "album" && (
                  <TopList stats={stats} kinds={["topTracks"]} title="Titres de l'album" />
                )}
                {selection.kind === "track" && stats.topAlbums[0] && <AlbumCard stats={stats} />}
                <Moments stats={stats} />
              </div>
            </>
          )}
        </ImagesProvider>
      )}
    </div>
  );
}

/** Sur la page d'un titre : l'album dont il vient. */
function AlbumCard({ stats }: { stats: Stats }) {
  const album = stats.topAlbums[0]!;
  const image = useImage("album", album);
  return (
    <section
      aria-label="Album"
      className="glass flex items-center gap-4 self-start rounded-3xl p-4 sm:p-6"
    >
      <span
        aria-hidden
        className="relative size-20 shrink-0 overflow-hidden rounded-xl"
        style={{ background: gradientFor(album.label) }}
      >
        <Artwork src={image} />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-xs tracking-wide text-muted-foreground uppercase">
          Sur l&apos;album
        </span>
        <SelectionLink
          selection={entrySelection("album", album)}
          className="font-heading text-lg font-semibold break-words underline-offset-4 hover:underline"
        >
          {album.label}
        </SelectionLink>
      </span>
    </section>
  );
}

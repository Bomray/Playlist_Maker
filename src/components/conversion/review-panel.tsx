"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { ConversionReport } from "@/core/convert";
import type { Track } from "@/core/models";
import type { UserError } from "@/lib/user-error";
import { ErrorAlert } from "./error-alert";
import { countLabel, type InitialStatus, providerLabel } from "./format";
import { inputClass } from "./playlist-form";
import { TrackRow } from "./track-row";

interface Props {
  report: ConversionReport;
  initialStatuses: InitialStatus[];
  creating: boolean;
  error: UserError | null;
  onSelect: (index: number, track: Track | null) => void;
  onCreate: (name: string, description: string | null) => void;
  onRestart: () => void;
}

const SECTIONS: { status: InitialStatus; title: string; hint: string; open: boolean }[] = [
  {
    status: "uncertain",
    title: "Incertains",
    hint: "Un titre ressemblant a été trouvé : valide-le, choisis-en un autre ou laisse-le de côté.",
    open: true,
  },
  {
    status: "not_found",
    title: "Introuvables",
    hint: "Aucune correspondance fiable : tu peux chercher à la main.",
    open: true,
  },
  {
    status: "found",
    title: "Trouvés",
    hint: "Correspondance sûre (ISRC ou titre, artiste et durée).",
    open: false,
  },
];

/** Étape 3 : récapitulatif, corrections, puis création de la playlist. */
export function ReviewPanel(props: Props) {
  const { report, initialStatuses, creating, error, onSelect, onCreate, onRestart } = props;
  const id = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [name, setName] = useState(report.playlist.name);
  const [description, setDescription] = useState(
    `Convertie depuis ${providerLabel(report.playlist.ref.provider)} avec Wavl`,
  );
  const { summary } = report;

  // À l'arrivée du récap, le focus va sur son titre (lecteurs d'écran, clavier).
  useEffect(() => headingRef.current?.focus(), []);

  return (
    <section aria-labelledby={`${id}-title`} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h2
          id={`${id}-title`}
          ref={headingRef}
          tabIndex={-1}
          className="text-lg font-semibold outline-none"
        >
          Récapitulatif : « {report.playlist.name} »
        </h2>
        <ul className="grid grid-cols-3 gap-2 text-center text-sm">
          <Stat label="Trouvés" value={initialStatuses.filter((s) => s === "found").length} />
          <Stat
            label="Incertains"
            value={initialStatuses.filter((s) => s === "uncertain").length}
          />
          <Stat
            label="Introuvables"
            value={initialStatuses.filter((s) => s === "not_found").length}
          />
        </ul>
        <p aria-live="polite" className="text-sm text-muted-foreground">
          {countLabel(summary.selected, "titre")} sur {summary.total}{" "}
          {summary.selected > 1 ? "seront ajoutés" : "sera ajouté"}.
        </p>
        {(report.playlist.unavailableCount ?? 0) > 0 && (
          <p className="text-sm text-muted-foreground">
            {countLabel(report.playlist.unavailableCount ?? 0, "titre")} de la playlist
            d&apos;origine {(report.playlist.unavailableCount ?? 0) > 1 ? "sont" : "est"}{" "}
            indisponible
            {(report.playlist.unavailableCount ?? 0) > 1 ? "s" : ""} (supprimé ou privé) et ne peut
            pas être converti.
          </p>
        )}
      </div>

      {SECTIONS.map(({ status, title, hint, open }) => {
        const rows = report.results
          .map((match, index) => ({ match, index }))
          .filter(({ index }) => initialStatuses[index] === status);
        if (rows.length === 0) return null;
        return (
          <details key={status} open={open} className="group flex flex-col gap-2">
            <summary className="cursor-pointer rounded-md py-1 text-base font-semibold">
              {title} ({rows.length})
            </summary>
            <p className="mb-2 text-sm text-muted-foreground">{hint}</p>
            <ul className="flex flex-col gap-2">
              {rows.map(({ match, index }) => (
                <TrackRow
                  key={`${index}-${match.source.providerTrackId}`}
                  match={match}
                  onSelect={(track) => onSelect(index, track)}
                />
              ))}
            </ul>
          </details>
        );
      })}

      <form
        className="flex flex-col gap-3 rounded-lg border p-3"
        onSubmit={(e) => {
          e.preventDefault();
          onCreate(name, description);
        }}
      >
        <h3 className="font-semibold">Créer la playlist sur Spotify</h3>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-name`} className="text-sm font-medium">
            Nom
          </label>
          <input
            id={`${id}-name`}
            required
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-desc`} className="text-sm font-medium">
            Description (facultative)
          </label>
          <input
            id={`${id}-desc`}
            maxLength={300}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={inputClass}
          />
        </div>
        {error && <ErrorAlert error={error} />}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="submit" size="lg" disabled={creating || summary.selected === 0}>
            {creating
              ? "Création…"
              : `Créer la playlist (${countLabel(summary.selected, "titre")})`}
          </Button>
          <Button type="button" size="lg" variant="outline" onClick={onRestart} disabled={creating}>
            Recommencer
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Playlist privée, visible seulement par toi.</p>
      </form>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <li className="rounded-lg bg-muted p-2">
      <span className="block text-xl font-semibold">{value}</span>
      {label}
    </li>
  );
}

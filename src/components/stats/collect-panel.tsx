"use client";
// Interrupteur « Enregistrer automatiquement mes nouvelles écoutes » (accord explicite) et
// état de la dernière collecte.
import { useCallback, useEffect, useId, useState } from "react";
import type { CollectStatus } from "@/lib/db/collect";
import { formatInt } from "./format";
import { NextCollection } from "./next-collection";

type Load =
  | { status: "loading" }
  | { status: "ready"; data: CollectStatus }
  | { status: "error"; message: string };

const timeFmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" });

async function request(init?: RequestInit): Promise<CollectStatus> {
  const res = await fetch("/api/stats/collect", { cache: "no-store", ...init });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const error = (body as { error?: { message?: string } | string } | null)?.error;
    throw new Error(
      typeof error === "string"
        ? error
        : (error?.message ?? `Erreur du serveur (HTTP ${res.status})`),
    );
  }
  return body as CollectStatus;
}

/** `onNewPlays` : appelé quand la première collecte a ajouté des écoutes (pour recharger). */
export function CollectPanel({ onNewPlays }: { onNewPlays: () => void }) {
  const id = useId();
  const [state, setState] = useState<Load>({ status: "loading" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    request()
      .then((data) => alive && setState({ status: "ready", data }))
      .catch((e: Error) => alive && setState({ status: "error", message: e.message }));
    return () => {
      alive = false;
    };
  }, []);

  async function toggle(enabled: boolean) {
    const before = state.status === "ready" ? state.data.apiPlays : 0;
    setSaving(true);
    try {
      const data = await request({
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      setState({ status: "ready", data });
      if (enabled && data.apiPlays > before) onNewPlays();
    } catch (e) {
      setState({ status: "error", message: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  const apiPlaysNow = state.status === "ready" ? state.data.apiPlays : null;
  // Relevé attendu : on relit l'état, et on recharge les stats s'il a apporté des écoutes.
  const poll = useCallback(() => {
    request()
      .then((data) => {
        setState({ status: "ready", data });
        if (apiPlaysNow !== null && data.apiPlays > apiPlaysNow) onNewPlays();
      })
      .catch((e: Error) => console.warn("État de la collecte indisponible", e.message));
  }, [apiPlaysNow, onNewPlays]);

  if (state.status === "loading") return null;
  if (state.status === "error") {
    return (
      <p role="alert" className="rounded-lg border border-destructive/60 p-3 text-sm">
        Enregistrement automatique : {state.message}
      </p>
    );
  }

  const { collecting, lastCollectedAt, lastError, apiPlays } = state.data;
  return (
    <section
      aria-label="Enregistrement automatique"
      className="glass flex flex-col gap-2 rounded-3xl p-4 text-sm"
    >
      <label htmlFor={id} className="flex cursor-pointer items-center justify-between gap-3">
        <span className="font-medium">Enregistrer automatiquement mes nouvelles écoutes</span>
        {/* Case à cocher native, présentée en interrupteur : accessible au clavier et aux lecteurs d'écran. */}
        <input
          id={id}
          type="checkbox"
          role="switch"
          checked={collecting}
          disabled={saving}
          onChange={(e) => toggle(e.target.checked)}
          className="peer h-6 w-11 shrink-0 cursor-pointer appearance-none rounded-full border border-input bg-muted transition-colors before:block before:size-5 before:translate-x-0.5 before:rounded-full before:bg-background before:shadow before:transition-transform checked:bg-viz-series checked:before:translate-x-5.5 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
        />
      </label>
      <p className="text-muted-foreground">
        {saving
          ? "Enregistrement en cours…"
          : collecting
            ? "Activé : tes écoutes sont relevées toutes les heures."
            : "Désactivé. Une fois activé, l'appli relève tes écoutes Spotify toutes les heures, même quand elle est fermée."}
      </p>
      {collecting && !saving && <NextCollection lastCollectedAt={lastCollectedAt} onPoll={poll} />}
      {lastError && collecting && <p className="text-destructive">{lastError}</p>}
      {(apiPlays > 0 || lastCollectedAt) && (
        <p className="text-xs text-muted-foreground">
          {formatInt(apiPlays)} écoutes enregistrées automatiquement
          {lastCollectedAt ? `, dernier relevé le ${timeFmt.format(lastCollectedAt)}` : ""}. Leur
          durée est estimée (durée du morceau) : Spotify ne donne pas le temps réellement écouté.
        </p>
      )}
    </section>
  );
}

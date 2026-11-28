"use client";
import { useEffect } from "react";
// Écran des stats : dépôt de l'export → lecture (progression) → stats par période.
import { Button } from "@/components/ui/button";
import { AccountPanel } from "./account-panel";
import { CollectPanel } from "./collect-panel";
import { ExportDrop } from "./export-drop";
import { formatInt } from "./format";
import { DetailView } from "./detail-view";
import { ImagesProvider } from "./images";
import { useSelection, useTopsTab } from "./selection-link";
import { TopsView } from "./tops-view";
import { PeriodPicker } from "./period-picker";
import { StatsDashboard } from "./stats-dashboard";
import { useStats } from "./use-stats";
import { ProgressBar } from "@/components/layout/progress-bar";

export function StatsApp({ loggedIn }: { loggedIn: boolean }) {
  const {
    state,
    load,
    loadAccount,
    selectPeriod,
    showDetail,
    requestTops,
    upload,
    deleteAccountData,
    reset,
  } = useStats(loggedIn);
  const topsTab = useTopsTab();
  // Page de détail ouverte d'après l'adresse (?artiste=…, ?album=…, ?titre=…).
  const selection = useSelection();
  const ready = state.phase === "ready";
  useEffect(() => {
    if (ready) showDetail(selection);
  }, [ready, selection, showDetail]);

  const collect = loggedIn && state.phase !== "loading" && (
    <CollectPanel onNewPlays={loadAccount} />
  );

  if (state.phase === "idle") {
    return (
      <div className="flex flex-col gap-4">
        {collect}
        {state.notice && (
          <p aria-live="polite" className="rounded-lg bg-muted p-3 text-sm">
            {state.notice}
          </p>
        )}
        {state.accountEmpty && (
          <p className="text-sm">
            Aucun historique enregistré dans ton compte pour l&apos;instant : dépose ton export,
            puis enregistre-le.
          </p>
        )}
        <ExportDrop onFiles={load} loggedIn={loggedIn} />
        {state.error && (
          <div
            role="alert"
            className="flex flex-col items-start gap-2 rounded-lg border border-destructive/60 p-3 text-sm"
          >
            <p className="font-semibold text-destructive">Lecture impossible</p>
            <p>{state.error}</p>
            {loggedIn && (
              <Button size="sm" variant="outline" onClick={loadAccount}>
                Recharger mon historique enregistré
              </Button>
            )}
          </div>
        )}
      </div>
    );
  }

  if (state.phase === "loading") {
    const fromAccount = state.source === "account";
    return (
      <section aria-labelledby="loading-title" className="flex flex-col gap-3">
        <h2 id="loading-title" className="text-lg font-semibold">
          {fromAccount ? "Chargement de ton historique…" : "Lecture de l'export…"}
        </h2>
        <ProgressBar
          max={state.total || undefined}
          value={state.total ? state.done : undefined}
          label="Progression du chargement"
        />
        <p aria-live="polite" className="text-sm text-muted-foreground">
          {state.total === null
            ? fromAccount
              ? "Connexion à ton compte…"
              : "Décompression de l'archive…"
            : fromAccount
              ? `${formatInt(state.done)} / ${formatInt(state.total)} écoutes`
              : `Fichier ${state.done} / ${state.total}`}
        </p>
      </section>
    );
  }

  const { stats, period, years } = state;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>
          {state.source === "account"
            ? `${formatInt(state.plays)} écoutes enregistrées`
            : `${formatInt(state.plays)} lectures dans ${state.historyFiles} fichier${state.historyFiles > 1 ? "s" : ""}`}
          {state.skippedEntries > 0 &&
            ` (${formatInt(state.skippedEntries)} entrées ignorées : livres audio ou format inconnu)`}
        </span>
        {state.source === "file" && (
          <Button variant="outline" size="sm" onClick={reset}>
            Changer d&apos;export
          </Button>
        )}
      </div>

      {collect}
      <PeriodPicker period={period} years={years} onChange={selectPeriod} />
      <ImagesProvider stats={stats} enabled={loggedIn}>
        {topsTab ? (
          <TopsView
            tab={topsTab}
            period={period}
            loggedIn={loggedIn}
            version={stats}
            requestTops={requestTops}
          />
        ) : state.detail ? (
          <DetailView
            selection={state.detail.selection}
            stats={state.detail.stats}
            main={stats}
            period={period}
            loggedIn={loggedIn}
          />
        ) : (
          <StatsDashboard stats={stats} period={period} />
        )}
      </ImagesProvider>

      <AccountPanel
        loggedIn={loggedIn}
        source={state.source}
        plays={state.plays}
        upload={state.upload}
        onUpload={upload}
        onShowAccount={loadAccount}
        onAddExport={reset}
        onDelete={deleteAccountData}
      />
    </div>
  );
}

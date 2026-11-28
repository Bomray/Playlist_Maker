"use client";
// Pilote le Web Worker de stats : export déposé ou historique enregistré, calcul par période,
// enregistrement dans le compte et suppression.
import { useCallback, useEffect, useRef, useState } from "react";
import {
  type Period,
  periodBounds,
  type Selection,
  type Stats,
  type TopMetric,
} from "@/core/stats";
import type { DataSource, TopKind, WorkerRequest, WorkerResponse } from "./worker-protocol";

export interface TopsQuery {
  kind: TopKind;
  metric: TopMetric;
  query: string;
  offset: number;
  limit: number;
}
export type TopsPage = Extract<WorkerResponse, { type: "tops" }>;

export type UploadState =
  | { status: "idle" }
  | { status: "sending"; sent: number; total: number }
  | { status: "done"; received: number; inserted: number }
  | { status: "error"; message: string };

export type StatsState =
  | {
      phase: "idle";
      error: string | null;
      /** Connecté mais aucun historique enregistré : inviter à déposer puis enregistrer. */
      accountEmpty: boolean;
      /** Message de confirmation (ex. après suppression). */
      notice: string | null;
    }
  | { phase: "loading"; source: DataSource; done: number; total: number | null }
  | {
      phase: "ready";
      source: DataSource;
      plays: number;
      historyFiles: number;
      skippedEntries: number;
      years: number[];
      period: Period;
      stats: Stats | null;
      /** Page de détail ouverte (artiste, album, titre) et ses stats sur la même période. */
      detail: { selection: Selection; stats: Stats | null } | null;
      upload: UploadState;
    };

const IDLE: Extract<StatsState, { phase: "idle" }> = {
  phase: "idle",
  error: null,
  accountEmpty: false,
  notice: null,
};

export function useStats(loggedIn: boolean) {
  // Connecté : on commence directement par charger l'historique enregistré.
  const [state, setState] = useState<StatsState>(() =>
    loggedIn ? { phase: "loading", source: "account", done: 0, total: null } : IDLE,
  );
  const workerRef = useRef<Worker | null>(null);
  const timeZone = useRef(Intl.DateTimeFormat().resolvedOptions().timeZone);
  // Période gardée d'un chargement à l'autre (ex. rechargement après un relevé automatique).
  const send = (msg: WorkerRequest) => workerRef.current?.postMessage(msg);
  const periodRef = useRef<Period>({ kind: "all" });
  const selectionRef = useRef<Selection | null>(null);
  // Pages de tops demandées au worker, en attente de réponse.
  const pendingTops = useRef(new Map<number, (page: TopsPage) => void>());
  const nextRequest = useRef(1);

  /** Demande les stats de la page (et du détail ouvert) pour la période courante. */
  const computeAll = useCallback(() => {
    const base = {
      type: "compute",
      timeZone: timeZone.current,
      ...periodBounds(periodRef.current),
    } as const;
    send({ ...base, target: "main" });
    if (selectionRef.current) send({ ...base, target: "detail", selection: selectionRef.current });
  }, []);

  const onMessage = useCallback(
    (msg: WorkerResponse) => {
      switch (msg.type) {
        case "progress":
          setState((s) => (s.phase === "loading" ? { ...s, done: msg.done, total: msg.total } : s));
          break;
        case "loaded": {
          const { type, ...rest } = msg;
          void type;
          setState({
            phase: "ready",
            ...rest,
            period: periodRef.current,
            stats: null,
            detail: selectionRef.current ? { selection: selectionRef.current, stats: null } : null,
            upload: { status: "idle" },
          });
          computeAll();
          break;
        }
        case "accountEmpty":
          setState({ ...IDLE, accountEmpty: true });
          break;
        case "stats":
          setState((s) => {
            if (s.phase !== "ready") return s;
            if (msg.target === "main") return { ...s, stats: msg.stats };
            return s.detail ? { ...s, detail: { ...s.detail, stats: msg.stats } } : s;
          });
          break;
        case "tops":
          pendingTops.current.get(msg.requestId)?.(msg);
          pendingTops.current.delete(msg.requestId);
          break;
        case "uploadProgress":
          setState((s) =>
            s.phase === "ready"
              ? { ...s, upload: { status: "sending", sent: msg.sent, total: msg.total } }
              : s,
          );
          break;
        case "uploaded":
          setState((s) =>
            s.phase === "ready"
              ? { ...s, upload: { status: "done", received: msg.received, inserted: msg.inserted } }
              : s,
          );
          break;
        case "error":
          if (msg.during === "upload") {
            setState((s) =>
              s.phase === "ready" ? { ...s, upload: { status: "error", message: msg.message } } : s,
            );
          } else {
            setState({ ...IDLE, error: msg.message });
          }
          break;
      }
    },
    [computeAll],
  );

  /** Démarre un worker vide et lui envoie une première demande (sans toucher à l'état). */
  const spawn = useCallback(
    (first: WorkerRequest) => {
      workerRef.current?.terminate();
      // Syntaxe reconnue par Turbopack/webpack : le worker est compilé comme un fichier à part.
      const worker = new Worker(new URL("./stats.worker.ts", import.meta.url), { type: "module" });
      workerRef.current = worker;
      worker.onmessage = (event: MessageEvent<WorkerResponse>) => onMessage(event.data);
      worker.onerror = (e) => {
        console.error("Worker de stats arrêté", e);
        setState({
          ...IDLE,
          error: "Le traitement a échoué (mémoire insuffisante ?). Réessaie sur un ordinateur.",
        });
      };
      worker.postMessage(first);
    },
    [onMessage],
  );

  const start = useCallback(
    (first: WorkerRequest, source: DataSource) => {
      setState({ phase: "loading", source, done: 0, total: null });
      spawn(first);
    },
    [spawn],
  );

  const load = useCallback((files: File[]) => start({ type: "load", files }, "file"), [start]);
  const loadAccount = useCallback(() => start({ type: "loadAccount" }, "account"), [start]);

  // Connecté : l'état initial est déjà « chargement », il suffit de lancer le worker.
  useEffect(() => {
    if (loggedIn) spawn({ type: "loadAccount" });
    return () => workerRef.current?.terminate();
  }, [loggedIn, spawn]);

  const selectPeriod = useCallback(
    (period: Period) => {
      periodRef.current = period;
      setState((s) =>
        s.phase === "ready"
          ? { ...s, period, detail: s.detail && { ...s.detail, stats: null } }
          : s,
      );
      computeAll();
    },
    [computeAll],
  );

  /** Ouvre (ou ferme, avec `null`) la page d'un artiste, d'un album ou d'un titre. */
  const showDetail = useCallback((selection: Selection | null) => {
    selectionRef.current = selection;
    setState((s) =>
      s.phase === "ready" ? { ...s, detail: selection && { selection, stats: null } } : s,
    );
    if (selection) {
      send({
        type: "compute",
        target: "detail",
        timeZone: timeZone.current,
        selection,
        ...periodBounds(periodRef.current),
      });
    }
  }, []);

  /** Une page des tops complets de la période courante. */
  const requestTops = useCallback(
    (q: TopsQuery) =>
      new Promise<TopsPage>((resolve) => {
        const requestId = nextRequest.current++;
        pendingTops.current.set(requestId, resolve);
        send({
          type: "tops",
          requestId,
          timeZone: timeZone.current,
          ...periodBounds(periodRef.current),
          ...q,
        });
      }),
    [],
  );

  const upload = useCallback(() => {
    setState((s) =>
      s.phase === "ready" ? { ...s, upload: { status: "sending", sent: 0, total: s.plays } } : s,
    );
    send({ type: "upload" });
  }, []);

  /** Supprime tout l'historique enregistré (après confirmation dans l'interface). */
  const deleteAccountData = useCallback(async (): Promise<string | null> => {
    const res = await fetch("/api/stats/history", { method: "DELETE" }).catch(() => null);
    if (!res?.ok) return "La suppression a échoué. Réessaie.";
    const { deleted } = (await res.json()) as { deleted: number };
    workerRef.current?.terminate();
    workerRef.current = null;
    setState({
      ...IDLE,
      accountEmpty: true,
      notice: `${deleted.toLocaleString("fr-FR")} écoutes supprimées de ton compte.`,
    });
    return null;
  }, []);

  const reset = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
    setState(IDLE);
  }, []);

  return {
    state,
    load,
    loadAccount,
    selectPeriod,
    showDetail,
    requestTops,
    upload,
    deleteAccountData,
    reset,
  };
}

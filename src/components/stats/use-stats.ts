"use client";
// Pilote le Web Worker de stats : chargement de l'export, puis calcul par période.
import { useCallback, useEffect, useRef, useState } from "react";
import type { Stats } from "@/core/stats";
import type { WorkerRequest, WorkerResponse } from "./worker-protocol";

export type Period = { kind: "all" } | { kind: "year"; year: number };

export type StatsState =
  | { phase: "idle"; error: string | null }
  | { phase: "loading"; done: number; total: number | null }
  | {
      phase: "ready";
      plays: number;
      historyFiles: number;
      skippedEntries: number;
      years: number[];
      period: Period;
      stats: Stats | null;
    };

/** Bornes d'une période, dans le fuseau du navigateur (celui utilisé pour les calculs). */
function bounds(period: Period): { from?: number; to?: number } {
  if (period.kind === "all") return {};
  return {
    from: new Date(period.year, 0, 1).getTime(),
    to: new Date(period.year + 1, 0, 1).getTime() - 1,
  };
}

export function useStats() {
  const [state, setState] = useState<StatsState>({ phase: "idle", error: null });
  const workerRef = useRef<Worker | null>(null);
  const timeZone = useRef(Intl.DateTimeFormat().resolvedOptions().timeZone);

  const send = (msg: WorkerRequest) => workerRef.current?.postMessage(msg);

  useEffect(() => () => workerRef.current?.terminate(), []);

  const load = useCallback((files: File[]) => {
    workerRef.current?.terminate();
    // Syntaxe reconnue par Turbopack/webpack : le worker est compilé comme un fichier à part.
    const worker = new Worker(new URL("./stats.worker.ts", import.meta.url), { type: "module" });
    workerRef.current = worker;
    setState({ phase: "loading", done: 0, total: null });

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const msg = event.data;
      if (msg.type === "progress") setState({ phase: "loading", done: msg.done, total: msg.total });
      else if (msg.type === "loaded") {
        setState({ phase: "ready", ...msg, period: { kind: "all" }, stats: null });
        worker.postMessage({ type: "compute", timeZone: timeZone.current } satisfies WorkerRequest);
      } else if (msg.type === "stats") {
        setState((s) => (s.phase === "ready" ? { ...s, stats: msg.stats } : s));
      } else {
        worker.terminate();
        workerRef.current = null;
        setState({ phase: "idle", error: msg.message });
      }
    };
    worker.onerror = (e) => {
      console.error("Worker de stats arrêté", e);
      setState({
        phase: "idle",
        error:
          "La lecture de l'export a échoué (mémoire insuffisante ?). Réessaie sur un ordinateur.",
      });
    };
    worker.postMessage({ type: "load", files } satisfies WorkerRequest);
  }, []);

  const selectPeriod = useCallback((period: Period) => {
    setState((s) => (s.phase === "ready" ? { ...s, period } : s));
    send({ type: "compute", timeZone: timeZone.current, ...bounds(period) });
  }, []);

  const reset = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
    setState({ phase: "idle", error: null });
  }, []);

  return { state, load, selectPeriod, reset };
}

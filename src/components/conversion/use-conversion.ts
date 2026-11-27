"use client";
// Pilote une conversion : lecture du flux /api/convert, corrections, création.
import { useCallback, useEffect, useReducer, useRef } from "react";
import { createConvertedPlaylist } from "@/app/actions/conversion";
import { readConversionEvents } from "@/lib/conversion-stream";
import type { UserError } from "@/lib/user-error";
import type { Track } from "@/core/models";
import { conversionReducer, initialState, playlistToCreate } from "./conversion-state";

const NETWORK_ERROR: UserError = {
  kind: "network",
  provider: null,
  message: "Connexion au serveur perdue. Vérifie ta connexion et réessaie.",
  retryAfterSeconds: null,
};

/** Lit l'erreur JSON renvoyée par la route avant le flux (401, 400…). */
async function errorFromResponse(res: Response): Promise<UserError> {
  const body: unknown = await res.json().catch(() => null);
  const error = (body as { error?: unknown } | null)?.error;
  if (error && typeof error === "object" && "kind" in error && "message" in error) {
    return error as UserError;
  }
  return {
    kind: "unknown",
    provider: null,
    message: typeof error === "string" ? error : `Erreur du serveur (HTTP ${res.status})`,
    retryAfterSeconds: null,
  };
}

export function useConversion() {
  const [state, dispatch] = useReducer(conversionReducer, initialState);
  const abortRef = useRef<AbortController | null>(null);

  // Quitter la page annule la conversion en cours (le serveur arrête alors de chercher).
  useEffect(() => () => abortRef.current?.abort(), []);

  const start = useCallback(async (url: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    dispatch({ type: "start", url });

    try {
      const res = await fetch("/api/convert", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        dispatch({ type: "failed", error: await errorFromResponse(res) });
        return;
      }
      let finished = false;
      for await (const event of readConversionEvents(res.body)) {
        if (event.type === "playlist") dispatch(event);
        else if (event.type === "progress") dispatch(event);
        else if (event.type === "done") {
          finished = true;
          dispatch({ type: "done", report: event.report });
        } else {
          finished = true;
          dispatch({ type: "failed", error: event.error });
        }
      }
      // Flux coupé sans événement final (serveur redémarré, réseau…).
      if (!finished) dispatch({ type: "failed", error: NETWORK_ERROR });
    } catch (e) {
      // Annulation volontaire : l'état a déjà été remis à zéro par `cancel`.
      if (controller.signal.aborted) return;
      console.error("Conversion interrompue", e);
      dispatch({ type: "failed", error: NETWORK_ERROR });
    }
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    dispatch({ type: "cancel" });
  }, []);

  const select = useCallback((index: number, track: Track | null) => {
    dispatch({ type: "select", index, track });
  }, []);

  const create = useCallback(
    async (name: string, description: string | null) => {
      if (state.phase !== "review") return;
      const playlist = playlistToCreate(state.report, name, description);
      dispatch({ type: "creating" });
      const res = await createConvertedPlaylist(playlist).catch((e: unknown) => {
        console.error("Création interrompue", e);
        return { ok: false as const, error: NETWORK_ERROR };
      });
      if (res.ok) dispatch({ type: "created", created: res.data, added: playlist.trackIds.length });
      else dispatch({ type: "failed", error: res.error });
    },
    [state],
  );

  const reset = useCallback(() => dispatch({ type: "reset" }), []);

  return { state, start, cancel, select, create, reset };
}

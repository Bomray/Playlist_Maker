// État de l'écran de conversion, sous forme de reducer pur (testable sans React).
import { buildNewPlaylist, type ConversionReport, selectCandidate } from "@/core/convert";
import type { CreatedPlaylist, NewPlaylist, Track } from "@/core/models";
import type { ProgressItem, TrackPreview } from "@/lib/conversion-stream";
import type { UserError } from "@/lib/user-error";
import type { InitialStatus } from "./format";

export type ConversionState =
  | { phase: "idle"; error: UserError | null }
  | {
      phase: "running";
      url: string;
      playlistName: string | null;
      source: string | null;
      done: number;
      total: number | null;
      /** Aperçu des titres source et résultat de ceux déjà traités (même ordre). */
      tracks: TrackPreview[];
      items: ProgressItem[];
    }
  | {
      phase: "review" | "creating";
      report: ConversionReport;
      /** Statut d'origine de chaque titre, pour qu'une correction ne le change pas de section. */
      initialStatuses: InitialStatus[];
      error: UserError | null;
    }
  | { phase: "created"; report: ConversionReport; created: CreatedPlaylist; added: number };

export type ConversionAction =
  | { type: "start"; url: string }
  | { type: "playlist"; name: string; source: string; total: number; tracks?: TrackPreview[] }
  | { type: "progress"; done: number; total: number; item?: ProgressItem }
  | { type: "done"; report: ConversionReport }
  | { type: "failed"; error: UserError }
  | { type: "cancel" }
  | { type: "select"; index: number; track: Track | null }
  | { type: "creating" }
  | { type: "created"; created: CreatedPlaylist; added: number }
  | { type: "reset" };

export const initialState: ConversionState = { phase: "idle", error: null };

export function conversionReducer(
  state: ConversionState,
  action: ConversionAction,
): ConversionState {
  switch (action.type) {
    case "start":
      return {
        phase: "running",
        url: action.url,
        playlistName: null,
        source: null,
        done: 0,
        total: null,
        tracks: [],
        items: [],
      };
    case "playlist":
      if (state.phase !== "running") return state;
      return {
        ...state,
        playlistName: action.name,
        source: action.source,
        total: action.total,
        tracks: action.tracks ?? [],
      };
    case "progress":
      if (state.phase !== "running") return state;
      return {
        ...state,
        done: action.done,
        total: action.total,
        // Le `done`-ième titre vient d'être traité : son résultat va à l'index done - 1.
        items: action.item
          ? Object.assign([...state.items], { [action.done - 1]: action.item })
          : state.items,
      };
    case "done":
      return {
        phase: "review",
        report: action.report,
        initialStatuses: action.report.results.map((r) =>
          r.status === "manual" ? "uncertain" : r.status,
        ),
        error: null,
      };
    case "failed":
      // Pendant le récap (ex. création refusée), on garde le travail de l'utilisateur.
      if (state.phase === "review" || state.phase === "creating") {
        return { ...state, phase: "review", error: action.error };
      }
      return { phase: "idle", error: action.error };
    case "cancel":
      return state.phase === "running" ? initialState : state;
    case "select":
      if (state.phase !== "review") return state;
      return {
        ...state,
        report: selectCandidate(state.report, action.index, action.track),
        error: null,
      };
    case "creating":
      return state.phase === "review" ? { ...state, phase: "creating", error: null } : state;
    case "created":
      if (state.phase !== "creating") return state;
      return {
        phase: "created",
        report: state.report,
        created: action.created,
        added: action.added,
      };
    case "reset":
      return initialState;
  }
}

/** Playlist à créer d'après les choix actuels. */
export function playlistToCreate(
  report: ConversionReport,
  name: string,
  description: string | null,
): NewPlaylist {
  return buildNewPlaylist(report, { name: name.trim(), description: description?.trim() || null });
}

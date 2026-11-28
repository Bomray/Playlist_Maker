"use client";
// Écran de conversion : lien → progression → récapitulatif → playlist créée.
import { CreatedPanel } from "./created-panel";
import { ErrorAlert } from "./error-alert";
import { PlaylistForm } from "./playlist-form";
import { ProgressPanel } from "./progress-panel";
import { ReviewPanel } from "./review-panel";
import { useConversion } from "./use-conversion";

export function ConversionApp() {
  const { state, start, cancel, select, create, reset } = useConversion();

  switch (state.phase) {
    case "idle":
      return (
        <div className="flex flex-col gap-4">
          <PlaylistForm onSubmit={start} />
          {state.error && <ErrorAlert error={state.error} />}
        </div>
      );
    case "running":
      return (
        <ProgressPanel
          playlistName={state.playlistName}
          source={state.source}
          done={state.done}
          total={state.total}
          tracks={state.tracks}
          items={state.items}
          onCancel={cancel}
        />
      );
    case "review":
    case "creating":
      return (
        <ReviewPanel
          report={state.report}
          initialStatuses={state.initialStatuses}
          creating={state.phase === "creating"}
          error={state.error}
          onSelect={select}
          onCreate={create}
          onRestart={reset}
        />
      );
    case "created":
      return (
        <CreatedPanel
          report={state.report}
          created={state.created}
          added={state.added}
          onRestart={reset}
        />
      );
  }
}

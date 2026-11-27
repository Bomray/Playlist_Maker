"use client";

import { useId, useState } from "react";

/** Dépôt de l'export Spotify : archive .zip telle quelle, ou fichiers .json. */
export function ExportDrop({ onFiles }: { onFiles: (files: File[]) => void }) {
  const id = useId();
  const [dragging, setDragging] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <label
        htmlFor={id}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files.length > 0) onFiles([...e.dataTransfer.files]);
        }}
        className={`flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition-colors focus-within:border-ring hover:bg-muted ${
          dragging ? "border-ring bg-muted" : "border-border"
        }`}
      >
        <span className="font-medium">Dépose ton export Spotify ici</span>
        <span className="text-sm text-muted-foreground">
          ou appuie pour choisir l&apos;archive <code>my_spotify_data.zip</code> (ou ses fichiers
          .json)
        </span>
        <input
          id={id}
          type="file"
          multiple
          accept=".zip,.json,application/zip,application/json"
          className="sr-only"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) onFiles([...e.target.files]);
          }}
        />
      </label>
      <div className="flex flex-col gap-1 text-sm text-muted-foreground">
        <p>
          🔒 Les fichiers sont lus <strong>uniquement sur ton appareil</strong> : rien n&apos;est
          envoyé ni enregistré.
        </p>
        <p>
          Pas encore d&apos;export ? Demande-le sur{" "}
          <a
            href="https://www.spotify.com/account/privacy/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2"
          >
            la page Confidentialité de ton compte Spotify
            <span className="sr-only"> (nouvel onglet)</span>
          </a>{" "}
          en cochant « Historique de streaming étendu » (jusqu&apos;à 30 jours d&apos;attente).
        </p>
      </div>
    </div>
  );
}

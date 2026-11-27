"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";

export const inputClass =
  "h-10 w-full min-w-0 rounded-lg border border-input bg-background px-3 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50";

/** Étape 1 : coller le lien de la playlist à convertir. */
export function PlaylistForm({ onSubmit }: { onSubmit: (url: string) => void }) {
  const id = useId();
  const [url, setUrl] = useState("");

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (url.trim()) onSubmit(url.trim());
      }}
    >
      <label htmlFor={id} className="text-sm font-medium">
        Lien de la playlist
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id={id}
          type="url"
          inputMode="url"
          required
          autoComplete="off"
          placeholder="https://www.deezer.com/playlist/…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          aria-describedby={`${id}-help`}
          className={inputClass}
        />
        <Button type="submit" size="lg" className="h-10 px-4">
          Convertir vers Spotify
        </Button>
      </div>
      <p id={`${id}-help`} className="text-xs text-muted-foreground">
        Playlist Deezer ou YouTube Music publique (lien complet ou lien court partagé depuis
        l&apos;application), ou une de tes playlists Spotify.
      </p>
    </form>
  );
}

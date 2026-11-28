import type { ReactNode } from "react";

/** Titre et sous-titre d'une page, en tête du contenu. */
export function PageIntro({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className="flex flex-col gap-2">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
      {children && <p className="max-w-2xl text-muted-foreground">{children}</p>}
    </header>
  );
}

/** Message d'échec de connexion à Spotify renvoyé par la page de retour (`?auth_error=`). */
export function AuthErrorAlert({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="glass rounded-2xl border-destructive/60 p-4 text-sm">
      <p className="font-semibold text-destructive">Échec de la connexion à Spotify</p>
      <p className="mt-1 break-words whitespace-pre-wrap">{message}</p>
    </div>
  );
}

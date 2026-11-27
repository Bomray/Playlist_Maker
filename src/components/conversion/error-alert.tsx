import { buttonVariants } from "@/components/ui/button";
import type { UserError } from "@/lib/user-error";
import { providerLabel } from "./format";

/** Message d'erreur typé, avec l'action utile quand il y en a une (se reconnecter…). */
export function ErrorAlert({ error }: { error: UserError }) {
  const who = error.provider ? `${providerLabel(error.provider)} : ` : "";
  return (
    <div role="alert" className="rounded-lg border border-destructive/60 p-3 text-sm">
      <p className="font-semibold text-destructive">{titleFor(error)}</p>
      <p className="mt-1 break-words">
        {who}
        {error.message}
      </p>
      {error.retryAfterSeconds !== null && (
        <p className="mt-1 text-muted-foreground">Réessaie dans {error.retryAfterSeconds} s.</p>
      )}
      {error.kind === "unauthorized" && (
        // Lien simple (pas <Link>) : la connexion passe par une redirection serveur.
        <a href="/api/auth/spotify/login" className={buttonVariants({ className: "mt-3" })}>
          Se connecter à Spotify
        </a>
      )}
    </div>
  );
}

function titleFor(error: UserError): string {
  switch (error.kind) {
    case "unauthorized":
      return "Connexion nécessaire";
    case "forbidden":
    case "not_accessible":
      return "Accès refusé";
    case "not_found":
      return "Introuvable";
    case "rate_limited":
    case "quota":
      return "Trop de requêtes";
    case "unsupported":
      return "Impossible";
    case "network":
      return "Problème de connexion";
    default:
      return "Erreur";
  }
}

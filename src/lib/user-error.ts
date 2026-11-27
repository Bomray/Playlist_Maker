// Erreur transmise au navigateur : seulement ce qu'il faut pour un message clair.
import { ProviderError, type ProviderErrorKind } from "@/core/errors";
import type { ProviderId } from "@/core/models";

export interface UserError {
  kind: ProviderErrorKind;
  provider: ProviderId | null;
  message: string;
  retryAfterSeconds: number | null;
}

/**
 * Convertit une erreur en message affichable. Une erreur qui n'est pas une
 * `ProviderError` est un bug : on la journalise côté serveur sans exposer son détail.
 */
export function toUserError(e: unknown): UserError {
  if (e instanceof ProviderError) {
    return {
      kind: e.kind,
      provider: e.provider,
      message: e.message,
      retryAfterSeconds: e.retryAfterSeconds,
    };
  }
  console.error("Erreur inattendue pendant une conversion", e);
  return {
    kind: "unknown",
    provider: null,
    message: "Erreur inattendue. Réessaie dans un instant.",
    retryAfterSeconds: null,
  };
}

/** Statut HTTP correspondant, pour les réponses non streamées. */
export function httpStatusFor(kind: ProviderErrorKind): number {
  switch (kind) {
    case "unauthorized":
      return 401;
    case "forbidden":
    case "not_accessible":
      return 403;
    case "not_found":
      return 404;
    case "rate_limited":
    case "quota":
      return 429;
    case "unsupported":
      return 400;
    case "network":
    case "invalid_response":
      return 502;
    default:
      return 500;
  }
}

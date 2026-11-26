import type { ProviderId } from "./models";

/**
 * Catégories d'erreurs affichées à l'utilisateur. Chaque erreur d'API est
 * convertie en l'une d'elles pour que l'UI puisse donner un message clair.
 */
export type ProviderErrorKind =
  | "unauthorized" // 401 : token absent, expiré ou révoqué
  | "forbidden" // 403 : action refusée (ex. restriction du Development Mode Spotify)
  | "rate_limited" // 429 : trop de requêtes
  | "quota" // quota journalier ou par période dépassé
  | "not_found" // 404 : ressource inexistante
  | "not_accessible" // ressource existante mais non lisible avec ces droits
  | "network" // pas de réponse (DNS, coupure, timeout)
  | "invalid_response" // réponse inattendue (schéma Zod non respecté)
  | "unknown"; // tout autre statut

export interface ProviderErrorInit {
  kind: ProviderErrorKind;
  provider: ProviderId | null;
  message: string;
  status?: number | null;
  /** Corps exact renvoyé par l'API, pour le diagnostic. */
  detail?: string | null;
  /** Délai conseillé avant de réessayer (en secondes), si l'API le donne. */
  retryAfterSeconds?: number | null;
}

export class ProviderError extends Error {
  readonly kind: ProviderErrorKind;
  readonly provider: ProviderId | null;
  readonly status: number | null;
  readonly detail: string | null;
  readonly retryAfterSeconds: number | null;

  constructor(init: ProviderErrorInit, options?: { cause?: unknown }) {
    super(init.message, options);
    this.name = "ProviderError";
    this.kind = init.kind;
    this.provider = init.provider;
    this.status = init.status ?? null;
    this.detail = init.detail ?? null;
    this.retryAfterSeconds = init.retryAfterSeconds ?? null;
  }
}

/** Associe un statut HTTP à une catégorie d'erreur. */
export function kindFromStatus(status: number): ProviderErrorKind {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 429) return "rate_limited";
  return "unknown";
}

// Appels HTTP JSON validés par Zod, avec conversion des échecs en ProviderError.
import type { z } from "zod";
import { kindFromStatus, ProviderError } from "@/core/errors";
import type { ProviderId } from "@/core/models";

export interface FetchJsonOptions extends RequestInit {
  provider: ProviderId;
}

function parseRetryAfter(header: string | null): number | null {
  if (!header) return null;
  const seconds = Number(header);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
}

/**
 * Exécute la requête, vérifie le statut puis valide le JSON avec `schema`.
 * Lève une ProviderError qui garde le statut et le corps exact de la réponse.
 */
export async function fetchJson<T>(
  url: string,
  schema: z.ZodType<T>,
  { provider, ...init }: FetchJsonOptions,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (cause) {
    throw new ProviderError(
      { kind: "network", provider, message: `Pas de réponse de ${new URL(url).host}` },
      { cause },
    );
  }

  const text = await res.text();
  if (!res.ok) {
    throw new ProviderError({
      kind: kindFromStatus(res.status),
      provider,
      status: res.status,
      message: `HTTP ${res.status} sur ${init.method ?? "GET"} ${new URL(url).pathname}`,
      detail: text,
      retryAfterSeconds: parseRetryAfter(res.headers.get("retry-after")),
    });
  }

  let json: unknown;
  try {
    json = text ? JSON.parse(text) : null;
  } catch (cause) {
    throw new ProviderError(
      {
        kind: "invalid_response",
        provider,
        status: res.status,
        message: "Réponse non JSON",
        detail: text,
      },
      { cause },
    );
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new ProviderError({
      kind: "invalid_response",
      provider,
      status: res.status,
      message: `Réponse inattendue : ${parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join(" ; ")}`,
      detail: text,
    });
  }
  return parsed.data;
}

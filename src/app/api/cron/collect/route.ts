// POST /api/cron/collect : appelée toutes les heures par GitHub Actions
// (.github/workflows/collect.yml) pour enregistrer les nouvelles écoutes de chaque
// utilisateur qui l'a accepté. Protégée par le secret partagé CRON_SECRET.
import { timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/lib/env";
import { collectAll } from "@/providers/spotify/collector";
import { accountDeps } from "@/providers/spotify/session";

/** 5 utilisateurs au plus (Development Mode) : quelques secondes chacun. */
export const maxDuration = 300;

/** Comparaison en temps constant : la durée ne révèle pas combien de caractères sont justes. */
function sameSecret(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request): Promise<Response> {
  const secret = serverEnv().CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_SECRET non configuré" }, { status: 503 });
  const auth = request.headers.get("authorization") ?? "";
  if (!sameSecret(auth, `Bearer ${secret}`))
    return Response.json({ error: "Non autorisé" }, { status: 401 });

  const results = await collectAll(accountDeps());
  // Seulement des compteurs : les journaux d'un dépôt public sont visibles par tous.
  return Response.json({
    users: results.length,
    fetched: results.reduce((n, r) => n + r.fetched, 0),
    inserted: results.reduce((n, r) => n + r.inserted, 0),
    errors: results.filter((r) => r.error !== null).length,
  });
}

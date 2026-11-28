// Protection des routes appelées par GitHub Actions : secret partagé CRON_SECRET.
import { timingSafeEqual } from "node:crypto";
import { serverEnv } from "./env";

/** Comparaison en temps constant : la durée ne révèle pas combien de caractères sont justes. */
function sameSecret(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Réponse d'erreur si l'appel n'est pas autorisé, `null` sinon. */
export function rejectUnlessCron(request: Request): Response | null {
  const secret = serverEnv().CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_SECRET non configuré" }, { status: 503 });
  const auth = request.headers.get("authorization") ?? "";
  if (!sameSecret(auth, `Bearer ${secret}`))
    return Response.json({ error: "Non autorisé" }, { status: 401 });
  return null;
}

// POST /api/cron/collect : appelée toutes les heures par GitHub Actions
// (.github/workflows/collect.yml) pour enregistrer les nouvelles écoutes de chaque
// utilisateur qui l'a accepté. Protégée par le secret partagé CRON_SECRET.
import { rejectUnlessCron } from "@/lib/cron-auth";
import { collectAll } from "@/providers/spotify/collector";
import { accountDeps } from "@/providers/spotify/session";

/** 5 utilisateurs au plus (Development Mode) : quelques secondes chacun. */
export const maxDuration = 300;

export async function POST(request: Request): Promise<Response> {
  const rejected = rejectUnlessCron(request);
  if (rejected) return rejected;

  const results = await collectAll(accountDeps());
  // Seulement des compteurs : les journaux d'un dépôt public sont visibles par tous.
  return Response.json({
    users: results.length,
    fetched: results.reduce((n, r) => n + r.fetched, 0),
    inserted: results.reduce((n, r) => n + r.inserted, 0),
    errors: results.filter((r) => r.error !== null).length,
  });
}

// POST /api/cron/images : appelée toutes les heures par GitHub Actions, après la collecte.
// Cherche les pochettes et photos d'artistes manquantes pendant 4 min au plus (spike 3 :
// ~9 300 titres et ~2 700 artistes pour un gros historique, soit quelques heures au total).
import { getDb } from "@/lib/db";
import { rejectUnlessCron } from "@/lib/cron-auth";
import { appToken } from "@/providers/spotify/auth";
import { fillImages } from "@/providers/spotify/images";
import { spotifyAuthConfig } from "@/providers/spotify/session";

export const maxDuration = 300;
/** Marge sous la limite de Vercel (300 s) pour répondre proprement. */
const BUDGET_MS = 240_000;

export async function POST(request: Request): Promise<Response> {
  const rejected = rejectUnlessCron(request);
  if (rejected) return rejected;

  const config = spotifyAuthConfig();
  let token: { accessToken: string; expiresAt: number } | null = null;
  const getToken = async () => {
    // Un token d'application dure une heure : on le redemande seulement s'il expire bientôt.
    if (!token || token.expiresAt - Date.now() < 60_000) token = await appToken(config);
    return token.accessToken;
  };

  const result = await fillImages({ db: getDb(), getToken }, BUDGET_MS);
  // Seulement des compteurs : les journaux d'un dépôt public sont visibles par tous.
  return Response.json(result);
}

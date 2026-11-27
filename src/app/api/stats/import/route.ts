// POST /api/stats/import : enregistre un lot d'écoutes de l'export Spotify (déjà réduites
// aux champs utiles par le navigateur) pour l'utilisateur connecté.
import { getDb } from "@/lib/db";
import { importPlays } from "@/lib/db/history";
import { decodePlay, type ImportResponse, ImportRequestSchema } from "@/lib/stats-sync";
import { httpStatusFor, toUserError } from "@/lib/user-error";
import { requireUserId } from "@/providers/spotify/session";

export async function POST(request: Request): Promise<Response> {
  // JSON obligatoire : un autre site ne peut pas l'envoyer sans requête préalable (CORS).
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return Response.json({ error: "Content-Type application/json attendu" }, { status: 415 });
  }
  let userId: string;
  try {
    userId = await requireUserId();
  } catch (e) {
    const error = toUserError(e);
    return Response.json({ error }, { status: httpStatusFor(error.kind) });
  }

  const parsed = ImportRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Lot d'écoutes invalide" }, { status: 400 });

  try {
    const plays = parsed.data.plays.map(decodePlay);
    const inserted = await importPlays(getDb(), userId, plays, "import");
    return Response.json({ received: plays.length, inserted } satisfies ImportResponse);
  } catch (e) {
    const error = toUserError(e);
    return Response.json({ error }, { status: httpStatusFor(error.kind) });
  }
}

// GET /api/stats/collect : état de l'enregistrement automatique pour l'utilisateur connecté.
// POST /api/stats/collect { enabled } : accord (ou retrait) ; à l'activation, une première
// collecte est faite tout de suite.
import { z } from "zod";
import { getDb } from "@/lib/db";
import { collectStatus, collectTargetFor, setCollecting } from "@/lib/db/collect";
import { httpStatusFor, toUserError } from "@/lib/user-error";
import { collectForUser } from "@/providers/spotify/collector";
import { accountDeps, requireUserId } from "@/providers/spotify/session";

const BodySchema = z.object({ enabled: z.boolean() });

function jsonError(e: unknown): Response {
  const error = toUserError(e);
  return Response.json({ error }, { status: httpStatusFor(error.kind) });
}

export async function GET(): Promise<Response> {
  try {
    return Response.json(await collectStatus(getDb(), await requireUserId()));
  } catch (e) {
    return jsonError(e);
  }
}

export async function POST(request: Request): Promise<Response> {
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return Response.json({ error: "Content-Type application/json attendu" }, { status: 415 });
  }
  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json({ error: "Corps attendu : { enabled: boolean }" }, { status: 400 });
  try {
    const userId = await requireUserId();
    const db = getDb();
    await setCollecting(db, userId, parsed.data.enabled);
    // Première collecte immédiate : l'utilisateur voit tout de suite si ça marche.
    if (parsed.data.enabled) {
      await collectForUser(accountDeps(), await collectTargetFor(db, userId));
    }
    return Response.json(await collectStatus(db, userId));
  } catch (e) {
    return jsonError(e);
  }
}

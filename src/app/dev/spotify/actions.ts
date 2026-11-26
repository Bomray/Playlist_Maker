"use server";

import { ProviderError } from "@/core/errors";
import { runSpotifyWriteTest, type StepResult } from "@/providers/spotify/dev-test";
import { getSpotifyAccessToken } from "@/providers/spotify/session";

export interface TestRunState {
  ranAt: string;
  steps: StepResult[];
}

/** Server Action : lancée seulement au clic, pour ne pas créer une playlist à chaque affichage. */
export async function runSpotifyTest(): Promise<TestRunState> {
  // Une Server Action est un point d'entrée public : on la ferme hors développement.
  if (process.env.NODE_ENV === "production") throw new Error("Indisponible en production");

  const ranAt = new Date().toISOString();
  let token: string;
  try {
    // Lit le cookie de session (et rafraîchit le token si besoin).
    token = await getSpotifyAccessToken();
  } catch (e) {
    if (!(e instanceof ProviderError)) throw e;
    return {
      ranAt,
      steps: [
        {
          label: "Récupération du token",
          request: "cookie de session",
          ok: false,
          output: e.detail ? `${e.message}\n\n${e.detail}` : e.message,
          httpStatus: e.status,
          errorKind: e.kind,
        },
      ],
    };
  }
  return { ranAt, steps: await runSpotifyWriteTest(token) };
}

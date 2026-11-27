"use server";

import { runSpotifyProviderCheck, type StepResult } from "@/providers/spotify/dev-check";
import { createSpotifyProvider } from "@/providers/spotify/provider";
import { getSpotifyAccessToken } from "@/providers/spotify/session";

export interface TestRunState {
  ranAt: string;
  steps: StepResult[];
}

/** Server Action : lancée seulement au clic, pour ne pas créer une playlist à chaque affichage. */
export async function runSpotifyTest(): Promise<TestRunState> {
  // Une Server Action est un point d'entrée public : on la ferme hors développement.
  if (process.env.NODE_ENV === "production") throw new Error("Indisponible en production");

  // Le token est lu dans le cookie (et rafraîchi si besoin) à chaque appel du provider.
  const spotify = createSpotifyProvider({ getAccessToken: getSpotifyAccessToken });
  return { ranAt: new Date().toISOString(), steps: await runSpotifyProviderCheck(spotify) };
}

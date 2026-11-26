// Cookies chiffrés : le navigateur les stocke mais ne peut ni les lire (httpOnly
// + chiffrement) ni les modifier (GCM authentifie le contenu).
import "server-only";
import { cookies } from "next/headers";
import type { z } from "zod";
import { seal, unseal } from "./crypto-box";
import { serverEnv } from "./env";

const BASE_OPTIONS = {
  httpOnly: true,
  // `lax` : le cookie est renvoyé lors de la redirection depuis accounts.spotify.com
  // (navigation de premier niveau en GET), mais pas sur les requêtes POST d'autres sites.
  sameSite: "lax",
  // En dev on est en http://127.0.0.1 : un cookie `secure` y serait refusé par certains navigateurs.
  secure: process.env.NODE_ENV === "production",
  path: "/",
} as const;

/** Lit et valide un cookie chiffré. Renvoie `null` s'il est absent, invalide ou modifié. */
export async function readSealedCookie<T>(name: string, schema: z.ZodType<T>): Promise<T | null> {
  const value = (await cookies()).get(name)?.value;
  if (!value) return null;
  const parsed = schema.safeParse(unseal(value, serverEnv().SESSION_SECRET));
  return parsed.success ? parsed.data : null;
}

/** À appeler uniquement dans une Server Action ou un Route Handler. */
export async function writeSealedCookie(
  name: string,
  data: unknown,
  maxAgeSeconds: number,
): Promise<void> {
  (await cookies()).set(name, seal(data, serverEnv().SESSION_SECRET), {
    ...BASE_OPTIONS,
    maxAge: maxAgeSeconds,
  });
}

/** À appeler uniquement dans une Server Action ou un Route Handler. */
export async function deleteCookie(name: string): Promise<void> {
  (await cookies()).delete({ name, path: BASE_OPTIONS.path });
}

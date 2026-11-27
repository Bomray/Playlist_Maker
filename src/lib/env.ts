import "server-only";
import { z } from "zod";

const EnvSchema = z.object({
  SPOTIFY_CLIENT_ID: z.string().min(1, "SPOTIFY_CLIENT_ID manquant dans .env.local"),
  // Absent en session cloud : le proxy ajoute lui-même l'authentification Basic.
  SPOTIFY_CLIENT_SECRET: z
    .string()
    .optional()
    .transform((v) => (v ? v : undefined)),
  // Clé développeur YouTube Data v3. Facultative : sans elle, les liens YouTube Music
  // affichent « non configuré » et le reste de l'appli fonctionne.
  YOUTUBE_API_KEY: z
    .string()
    .optional()
    .transform((v) => (v ? v : undefined)),
  SPOTIFY_REDIRECT_URI: z.url().default("http://127.0.0.1:3000/callback"),
  SESSION_SECRET: z
    .string()
    .min(32, "SESSION_SECRET doit faire au moins 32 caractères (voir .env.example)"),
});

export type ServerEnv = z.infer<typeof EnvSchema>;

let cached: ServerEnv | undefined;

/** Variables d'environnement serveur, validées au premier appel. */
export function serverEnv(): ServerEnv {
  if (!cached) {
    const parsed = EnvSchema.safeParse(process.env);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => `- ${i.message}`).join("\n");
      throw new Error(`Configuration invalide :\n${issues}`);
    }
    cached = parsed.data;
  }
  return cached;
}

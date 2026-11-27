// Petit flux OAuth « Authorization Code + PKCE » pour scripts lancés sur le PC :
// un serveur HTTP local reçoit la redirection et récupère le code. Rien n'est écrit sur disque.
import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:http";

export interface Pkce {
  verifier: string;
  challenge: string;
  state: string;
}

export function createPkce(): Pkce {
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge, state: randomBytes(16).toString("base64url") };
}

/**
 * Attend la redirection sur `redirectUri` (http://127.0.0.1:PORT/chemin) et renvoie le code.
 * Affiche l'URL d'autorisation à ouvrir dans le navigateur.
 */
export function waitForCode(authorizeUrl: string, redirectUri: string, state: string): Promise<string> {
  const target = new URL(redirectUri);
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? "/", redirectUri);
      if (url.pathname !== target.pathname) {
        res.writeHead(404).end();
        return;
      }
      const error = url.searchParams.get("error");
      const code = url.searchParams.get("code");
      const ok = !error && code && url.searchParams.get("state") === state;
      res.writeHead(ok ? 200 : 400, { "content-type": "text/plain; charset=utf-8" });
      res.end(ok ? "C'est bon, tu peux fermer cet onglet et revenir au terminal." : `Échec : ${error ?? "state invalide"}`);
      server.close();
      if (ok) resolve(code);
      else reject(new Error(`Autorisation refusée : ${error ?? "state invalide"}`));
    });
    server.on("error", (e: NodeJS.ErrnoException) => {
      reject(e.code === "EADDRINUSE" ? new Error(`Le port ${target.port} est occupé : arrête \`pnpm dev\` puis relance.`) : e);
    });
    server.listen(Number(target.port), target.hostname, () => {
      console.error(`\nOuvre ce lien dans ton navigateur pour autoriser l'accès :\n\n${authorizeUrl}\n`);
    });
  });
}

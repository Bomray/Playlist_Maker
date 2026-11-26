// PKCE (RFC 7636) : le navigateur ne voit jamais de secret. On génère un
// `code_verifier` aléatoire, on envoie son empreinte SHA-256 (`code_challenge`)
// à Spotify, puis on prouve qu'on le connaît au moment d'échanger le code.
import { createHash, randomBytes } from "node:crypto";

/** 48 octets aléatoires → 64 caractères base64url (la RFC demande 43 à 128). */
export function createCodeVerifier(): string {
  return randomBytes(48).toString("base64url");
}

export function codeChallengeS256(verifier: string): string {
  return createHash("sha256").update(verifier, "ascii").digest("base64url");
}

/** Valeur aléatoire liée à la tentative de connexion, vérifiée au retour (anti-CSRF). */
export function createState(): string {
  return randomBytes(16).toString("base64url");
}

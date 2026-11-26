// Chiffrement authentifié (AES-256-GCM) de petites données JSON, pour les cookies.
// GCM garantit la confidentialité ET l'intégrité : un cookie modifié est rejeté.
// Module pur (node:crypto seulement) pour pouvoir le tester sans Next.js.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const IV_BYTES = 12; // taille recommandée pour GCM
const TAG_BYTES = 16;

/** Dérive une clé de 32 octets à partir du secret (qui peut être de longueur quelconque). */
function keyFrom(secret: string): Buffer {
  return createHash("sha256").update(secret, "utf8").digest();
}

export function seal(data: unknown, secret: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", keyFrom(secret), iv);
  const plaintext = Buffer.from(JSON.stringify(data), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

/** Renvoie les données, ou `null` si le contenu est invalide, modifié ou chiffré avec une autre clé. */
export function unseal(sealed: string, secret: string): unknown {
  const raw = Buffer.from(sealed, "base64url");
  if (raw.length <= IV_BYTES + TAG_BYTES) return null;
  const iv = raw.subarray(0, IV_BYTES);
  const tag = raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const encrypted = raw.subarray(IV_BYTES + TAG_BYTES);
  try {
    const decipher = createDecipheriv("aes-256-gcm", keyFrom(secret), iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return JSON.parse(plaintext.toString("utf8")) as unknown;
  } catch {
    // Échec d'authentification GCM ou JSON illisible : on traite le cookie comme absent.
    return null;
  }
}

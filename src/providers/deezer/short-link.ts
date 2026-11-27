// Liens courts Deezer (`https://link.deezer.com/s/…`) : l'application mobile partage
// ce format, qui redirige (HTTP 302) vers le lien complet `www.deezer.com/…`.
import { ProviderError } from "@/core/errors";

/** Seuls ces hôtes sont suivis : on n'envoie pas de requête vers un hôte choisi par l'utilisateur. */
const SHORT_HOSTS = new Set(["link.deezer.com", "deezer.page.link"]);
const FINAL_HOST = /^(www\.)?deezer\.com$/i;
const MAX_REDIRECTS = 3;

function toUrl(input: string): URL | null {
  const trimmed = input.trim();
  try {
    return new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    // Texte qui n'est pas une URL : rien à développer.
    return null;
  }
}

export function isDeezerShortLink(input: string): boolean {
  const url = toUrl(input);
  return url !== null && SHORT_HOSTS.has(url.hostname.toLowerCase());
}

/**
 * Suit les redirections d'un lien court jusqu'au lien `deezer.com` complet.
 * Renvoie `null` si ce n'est pas un lien court Deezer. Les redirections sont suivies
 * à la main (`redirect: "manual"`) pour vérifier l'hôte à chaque étape.
 */
export async function expandDeezerShortLink(
  input: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  const start = toUrl(input);
  if (!start || !SHORT_HOSTS.has(start.hostname.toLowerCase())) return null;

  let url: URL = start;

  for (let hop = 0; hop < MAX_REDIRECTS; hop++) {
    let res: Response;
    try {
      res = await fetchImpl(url, { method: "GET", redirect: "manual", cache: "no-store" });
    } catch (cause) {
      throw new ProviderError(
        {
          kind: "network",
          provider: "deezer",
          message: "Impossible d'ouvrir le lien court Deezer",
        },
        { cause },
      );
    }
    // On ne lit pas le corps (page HTML) : seul l'en-tête Location nous intéresse.
    await res.body?.cancel();
    const location = res.headers.get("location");
    if (res.status < 300 || res.status >= 400 || !location) break;

    const next: URL = new URL(location, url);
    if (FINAL_HOST.test(next.hostname)) {
      // Deezer redirige les liens inconnus vers /deezer-links-404 (constaté).
      if (next.pathname.includes("links-404")) break;
      return next.toString();
    }
    if (!SHORT_HOSTS.has(next.hostname.toLowerCase())) break;
    url = next;
  }

  throw new ProviderError({
    kind: "not_found",
    provider: "deezer",
    message: "Ce lien court Deezer ne mène à aucune playlist (lien expiré ou incorrect).",
    detail: input,
  });
}

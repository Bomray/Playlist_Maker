// Spike 2 — Écriture d'une playlist YouTube (visible dans YT Music) via l'API officielle,
// avec le compte Google existant de l'utilisateur (OAuth). À lancer sur le PC :
//   pnpm youtube-write <videoId>
// Prérequis développeur (une fois) : identifiants OAuth « Application de bureau » dans
// Google Cloud → GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET dans .env.local.
import { z } from "zod";
import { fail, fetchJson, loadRootEnv, requireArg, requireEnv } from "./common.ts";
import { createPkce, waitForCode } from "./oauth-local.ts";

loadRootEnv();
// Les clients « Application de bureau » acceptent n'importe quel port de 127.0.0.1.
const REDIRECT_URI = "http://127.0.0.1:8765/oauth";
const API = "https://www.googleapis.com/youtube/v3";

const TokenSchema = z.object({ access_token: z.string(), scope: z.string() });
const PlaylistSchema = z.object({ id: z.string(), snippet: z.object({ title: z.string() }) });
const ItemSchema = z.object({ id: z.string() });

async function main(): Promise<void> {
  const videoId = requireArg("pnpm youtube-write <videoId>");
  const clientId = requireEnv("GOOGLE_OAUTH_CLIENT_ID");
  const clientSecret = requireEnv("GOOGLE_OAUTH_CLIENT_SECRET");
  const pkce = createPkce();

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/youtube",
    code_challenge: pkce.challenge,
    code_challenge_method: "S256",
    state: pkce.state,
  }).toString();
  const code = await waitForCode(url.toString(), REDIRECT_URI, pkce.state);

  // Pour une « Application de bureau », Google demande quand même le client_secret
  // (il n'est pas considéré comme secret pour ce type de client).
  const token = await fetchJson("https://oauth2.googleapis.com/token", TokenSchema, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
      client_id: clientId,
      client_secret: clientSecret,
      code_verifier: pkce.verifier,
    }),
  });
  const auth = { Authorization: `Bearer ${token.access_token}`, "content-type": "application/json" };

  const playlist = await fetchJson(`${API}/playlists?part=snippet,status`, PlaylistSchema, {
    method: "POST",
    headers: auth,
    body: JSON.stringify({
      snippet: { title: "Test Playlist Maker (spike)", description: "Créée par le spike 2, à supprimer" },
      status: { privacyStatus: "private" },
    }),
  });
  const item = await fetchJson(`${API}/playlistItems?part=snippet`, ItemSchema, {
    method: "POST",
    headers: auth,
    body: JSON.stringify({ snippet: { playlistId: playlist.id, resourceId: { kind: "youtube#video", videoId } } }),
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        scope: token.scope,
        playlist: `https://music.youtube.com/playlist?list=${playlist.id}`,
        itemId: item.id,
        quota: "playlists.insert 50 + playlistItems.insert 50 = 100 unités sur 10 000 par jour",
      },
      null,
      2,
    ),
  );
}

main().catch(fail);

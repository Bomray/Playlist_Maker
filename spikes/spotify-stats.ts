// Spike 2 — Stats d'écoute Spotify en Development Mode, avec le compte Spotify existant.
// À lancer sur le PC (connexion dans le navigateur), app arrêtée : `pnpm spotify-stats`.
import { z } from "zod";
import { fail, fetchJson, HttpError, loadRootEnv, requireEnv } from "./common.ts";
import { createPkce, waitForCode } from "./oauth-local.ts";
import { writeFileSync } from "node:fs";

loadRootEnv();
const API = "https://api.spotify.com/v1";
const REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI ?? "http://127.0.0.1:3000/callback";
const SCOPES = "user-top-read user-read-recently-played";

const TokenSchema = z.object({ access_token: z.string(), scope: z.string() });
const Artist = z.object({ name: z.string() });
const Track = z.object({ name: z.string(), artists: z.array(Artist), external_ids: z.object({ isrc: z.string().optional() }).optional() });
const TopTracks = z.object({ items: z.array(Track), total: z.number() });
const TopArtists = z.object({ items: z.array(z.object({ name: z.string(), genres: z.array(z.string()).optional() })), total: z.number() });
const Recent = z.object({
  items: z.array(z.object({ played_at: z.string(), track: Track })),
  cursors: z.object({ before: z.string().optional() }).nullable().optional(),
  next: z.string().nullable(),
});

interface Check {
  request: string;
  ok: boolean;
  status: number | null;
  summary: string;
  sample?: unknown;
}

async function login(): Promise<string> {
  const clientId = requireEnv("SPOTIFY_CLIENT_ID");
  const pkce = createPkce();
  const url = new URL("https://accounts.spotify.com/authorize");
  url.search = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    code_challenge_method: "S256",
    code_challenge: pkce.challenge,
    state: pkce.state,
  }).toString();
  const code = await waitForCode(url.toString(), REDIRECT_URI, pkce.state);
  // PKCE : client public, pas de secret nécessaire (client_id + code_verifier dans le corps).
  const token = await fetchJson("https://accounts.spotify.com/api/token", TokenSchema, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
      client_id: clientId,
      code_verifier: pkce.verifier,
    }),
  });
  console.error(`Connecté. Scopes accordés : ${token.scope}`);
  return token.access_token;
}

async function check<T>(request: string, schema: z.ZodType<T>, token: string, summarize: (d: T) => Pick<Check, "summary" | "sample">): Promise<Check> {
  try {
    const data = await fetchJson(`${API}${request}`, schema, { headers: { Authorization: `Bearer ${token}` } });
    return { request, ok: true, status: 200, ...summarize(data) };
  } catch (e) {
    if (!(e instanceof HttpError)) throw e;
    return { request, ok: false, status: e.status, summary: e.body.slice(0, 300) };
  }
}

const label = (t: z.infer<typeof Track>) => `${t.name} — ${t.artists.map((a) => a.name).join(", ")}`;

async function main(): Promise<void> {
  const token = await login();
  const checks: Check[] = [];

  for (const range of ["short_term", "medium_term", "long_term"]) {
    checks.push(
      await check(`/me/top/tracks?time_range=${range}&limit=50`, TopTracks, token, (d) => ({
        summary: `${d.items.length} titres (total annoncé ${d.total}), ISRC sur ${d.items.filter((t) => t.external_ids?.isrc).length}`,
        sample: d.items.slice(0, 5).map(label),
      })),
    );
  }
  checks.push(
    await check(`/me/top/artists?time_range=medium_term&limit=50`, TopArtists, token, (d) => ({
      summary: `${d.items.length} artistes, genres renseignés sur ${d.items.filter((a) => a.genres?.length).length}`,
      sample: d.items.slice(0, 5).map((a) => `${a.name} (${a.genres?.slice(0, 2).join(", ") || "sans genre"})`),
    })),
  );

  // Historique récent : jusqu'où peut-on remonter en suivant le curseur `before` ?
  let before: string | undefined;
  let total = 0;
  let oldest: string | null = null;
  for (let page = 0; page < 10; page++) {
    const request: string = `/me/player/recently-played?limit=50${before ? `&before=${before}` : ""}`;
    const res = await check(request, Recent, token, (d) => {
      total += d.items.length;
      oldest = d.items.at(-1)?.played_at ?? oldest;
      before = d.next ? (d.cursors?.before ?? undefined) : undefined;
      return { summary: `${d.items.length} écoutes`, sample: page === 0 ? d.items.slice(0, 5).map((i) => `${i.played_at} ${label(i.track)}`) : undefined };
    });
    checks.push(res);
    if (!res.ok || !before) break;
  }
  const history = `Historique récent : ${total} écoutes au total, la plus ancienne le ${oldest ?? "?"}.`;

  const result = { ranAt: new Date().toISOString(), checks, history };
  writeFileSync(new URL("./output/spotify-stats.json", import.meta.url), JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify(result, null, 2));
}

main().catch(fail);

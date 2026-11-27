// Spike 3 — Images (pochettes, photos d'artistes) en Development Mode, depuis le cloud.
// Teste chaque route possible et mesure le débit avant 429.
// Usage (session cloud) : NODE_USE_ENV_PROXY=1 pnpm tsx images.ts
import { writeFileSync } from "node:fs";
import { z } from "zod";
import { loadRootEnv } from "./common.ts";

loadRootEnv();
const API = "https://api.spotify.com/v1";

interface Check {
  name: string;
  status: number;
  ok: boolean;
  note: string;
}
const checks: Check[] = [];

async function token(): Promise<string> {
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  const headers: Record<string, string> = { "content-type": "application/x-www-form-urlencoded" };
  if (id && secret) headers.Authorization = `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`;
  const res = await fetch("https://accounts.spotify.com/api/token", { method: "POST", headers, body: new URLSearchParams({ grant_type: "client_credentials" }) });
  return z.object({ access_token: z.string() }).parse(await res.json()).access_token;
}

async function get(url: string, auth?: string): Promise<{ status: number; body: unknown; retryAfter: string | null }> {
  const res = await fetch(url, { headers: auth ? { Authorization: `Bearer ${auth}` } : {} });
  const text = await res.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    // corps non JSON (page HTML…) : gardé tel quel
  }
  return { status: res.status, body, retryAfter: res.headers.get("retry-after") };
}

function record(name: string, status: number, note: string) {
  checks.push({ name, status, ok: status === 200, note });
  console.error(`${status === 200 ? "✓" : "✗"} ${name} → ${status} ${note}`);
}

const imagesOf = (o: unknown): { url: string; width: number | null }[] =>
  (z.object({ images: z.array(z.object({ url: z.string(), width: z.number().nullable() })) }).safeParse(o).data?.images ?? []);

async function main() {
  const t = await token();

  // 1) IDs de test : morceaux et artistes trouvés par la recherche (catalogue public).
  const trackIds: string[] = [];
  const artistIds = new Set<string>();
  for (const q of ["Nekfeu", "Orelsan", "Bring Me The Horizon", "Lomepal", "PNL", "Bigflo Oli", "NF", "Juice WRLD", "Damso", "Vald"]) {
    const r = await get(`${API}/search?${new URLSearchParams({ q, type: "track", limit: "10", market: "FR" })}`, t);
    const items = z.object({ tracks: z.object({ items: z.array(z.object({ id: z.string(), artists: z.array(z.object({ id: z.string() })), album: z.object({ images: z.array(z.object({ url: z.string() })) }) })) }) }).safeParse(r.body);
    if (!items.success) {
      record(`search track "${q}"`, r.status, JSON.stringify(r.body).slice(0, 150));
      continue;
    }
    for (const i of items.data.tracks.items) {
      trackIds.push(i.id);
      i.artists.forEach((a) => artistIds.add(a.id));
    }
  }
  const withAlbumImg = trackIds.length;
  record("search track (pochette incluse dans album.images)", 200, `${withAlbumImg} titres trouvés`);

  const tid = trackIds[0]!;
  const aid = [...artistIds][0]!;

  // 2) Routes unitaires et groupées.
  let r = await get(`${API}/tracks/${tid}`, t);
  const tr = z.object({ album: z.object({ id: z.string(), images: z.array(z.object({ url: z.string(), width: z.number().nullable() })) }), artists: z.array(z.object({ id: z.string() })) }).safeParse(r.body);
  record("GET /tracks/{id}", r.status, tr.success ? `album.images: ${tr.data.album.images.map((i) => i.width).join("/")} px, artists[].id présent` : JSON.stringify(r.body).slice(0, 150));
  r = await get(`${API}/tracks?ids=${trackIds.slice(0, 20).join(",")}`, t);
  record("GET /tracks?ids= (groupé)", r.status, JSON.stringify(r.body).slice(0, 120));
  r = await get(`${API}/artists/${aid}`, t);
  record("GET /artists/{id}", r.status, r.status === 200 ? `images: ${imagesOf(r.body).map((i) => i.width).join("/")} px` : JSON.stringify(r.body).slice(0, 150));
  r = await get(`${API}/artists?ids=${[...artistIds].slice(0, 20).join(",")}`, t);
  record("GET /artists?ids= (groupé)", r.status, JSON.stringify(r.body).slice(0, 120));
  if (tr.success) {
    r = await get(`${API}/albums/${tr.data.album.id}`, t);
    record("GET /albums/{id}", r.status, r.status === 200 ? `images: ${imagesOf(r.body).length}` : JSON.stringify(r.body).slice(0, 150));
    r = await get(`${API}/albums?ids=${tr.data.album.id}`, t);
    record("GET /albums?ids= (groupé)", r.status, JSON.stringify(r.body).slice(0, 120));
  }
  r = await get(`${API}/search?${new URLSearchParams({ q: "Nekfeu", type: "artist", limit: "1" })}`, t);
  const sa = z.object({ artists: z.object({ items: z.array(z.object({ name: z.string(), images: z.array(z.object({ url: z.string() })) })) }) }).safeParse(r.body);
  record("search type=artist (photo par nom)", r.status, sa.success ? `${sa.data.artists.items[0]?.name} : ${sa.data.artists.items[0]?.images.length} images` : JSON.stringify(r.body).slice(0, 150));

  // 3) oEmbed public (sans authentification).
  for (const [kind, id] of [["track", tid], ["artist", aid]] as const) {
    r = await get(`https://open.spotify.com/oembed?url=${encodeURIComponent(`https://open.spotify.com/${kind}/${id}`)}`);
    const o = z.object({ thumbnail_url: z.string(), thumbnail_width: z.number().optional() }).safeParse(r.body);
    record(`oEmbed ${kind}`, r.status, o.success ? `thumbnail ${o.data.thumbnail_width ?? "?"} px` : JSON.stringify(r.body).slice(0, 150));
  }

  // 4) Débit : requêtes unitaires enchaînées jusqu'à 429 (ou fin de liste).
  async function burst(name: string, urls: string[], auth?: string) {
    const start = Date.now();
    let n = 0;
    for (const url of urls) {
      const res = await get(url, auth);
      if (res.status === 429) {
        record(`débit ${name}`, 429, `429 après ${n} requêtes en ${Date.now() - start} ms (Retry-After ${res.retryAfter})`);
        return;
      }
      if (res.status !== 200) {
        record(`débit ${name}`, res.status, `arrêt après ${n} requêtes`);
        return;
      }
      n++;
    }
    record(`débit ${name}`, 200, `${n} requêtes sans 429 en ${Date.now() - start} ms (${Math.round((n * 1000) / (Date.now() - start))}/s)`);
  }
  await burst("GET /tracks/{id}", trackIds.map((id) => `${API}/tracks/${id}`), t);
  await burst("GET /artists/{id}", [...artistIds].slice(0, 60).map((id) => `${API}/artists/${id}`), t);
  await burst("oEmbed track", trackIds.map((id) => `https://open.spotify.com/oembed?url=${encodeURIComponent(`https://open.spotify.com/track/${id}`)}`));

  writeFileSync(new URL("./output/images.json", import.meta.url), JSON.stringify({ ranAt: new Date().toISOString(), checks }, null, 2) + "\n");
}

main().catch((e) => {
  console.error("ÉCHEC", e);
  process.exit(1);
});

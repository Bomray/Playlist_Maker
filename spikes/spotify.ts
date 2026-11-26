// Spike Spotify : lecture d'une playlist publique en client credentials.
// Usage : pnpm tsx spotify.ts <lien de playlist>
import { z } from "zod";
import { fail, fetchJson, HttpError, output, requireArg, type SpikeTrack } from "./common.ts";

const API = "https://api.spotify.com/v1";

function parsePlaylistId(url: string): string {
  const m = /playlist[/:]([A-Za-z0-9]{22})/.exec(url);
  if (!m?.[1]) throw new Error(`Lien Spotify non reconnu : ${url}`);
  return m[1];
}

const TokenSchema = z.object({ access_token: z.string(), token_type: z.string(), expires_in: z.number() });

async function getToken(): Promise<string> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  if (!clientId) throw new Error("SPOTIFY_CLIENT_ID manquant");
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  const headers: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded" };
  // En session cloud, le secret n'existe pas : le proxy ajoute lui-même l'en-tête Basic.
  if (secret) headers.Authorization = `Basic ${Buffer.from(`${clientId}:${secret}`).toString("base64")}`;
  // Ne PAS mettre client_id dans le corps : combiné au Basic du proxy, Spotify répond
  // HTTP 400 {"error":"invalid_client"} (constaté pendant ce spike).
  const body = new URLSearchParams({ grant_type: "client_credentials" });
  const token = await fetchJson("https://accounts.spotify.com/api/token", TokenSchema, { method: "POST", headers, body });
  return token.access_token;
}

const TrackSchema = z.object({
  id: z.string().nullable(),
  name: z.string(),
  duration_ms: z.number(),
  artists: z.array(z.object({ name: z.string() })),
  album: z.object({ name: z.string() }).nullable().optional(),
  external_ids: z.object({ isrc: z.string().optional() }).optional(),
  type: z.string().optional(),
});
// Depuis 2026 l'API renomme `track` en `item` dans certaines réponses : on accepte les deux.
const PageSchema = z.object({
  items: z.array(z.object({ track: TrackSchema.nullable().optional(), item: TrackSchema.nullable().optional() })),
  next: z.string().nullable(),
  total: z.number(),
});
const PlaylistSchema = z.object({ id: z.string(), name: z.string() }).passthrough();

async function main(): Promise<void> {
  const url = requireArg("pnpm tsx spotify.ts <lien>");
  const id = parsePlaylistId(url);
  const notes: string[] = [];
  const token = await getToken();
  notes.push("Token client credentials obtenu.");
  const auth = { headers: { Authorization: `Bearer ${token}` } };

  let name: string | null = null;
  try {
    const pl = await fetchJson(`${API}/playlists/${id}?fields=id,name`, PlaylistSchema, auth);
    name = pl.name;
    notes.push(`GET /playlists/{id} OK (nom : ${pl.name}).`);
  } catch (e) {
    if (!(e instanceof HttpError)) throw e;
    notes.push(`GET /playlists/{id} : HTTP ${e.status} ${e.body}`);
  }

  const tracks: SpikeTrack[] = [];
  let total: number | null = null;
  for (const endpoint of ["items", "tracks"]) {
    let next: string | null = `${API}/playlists/${id}/${endpoint}?limit=50`;
    try {
      while (next) {
        const page: z.infer<typeof PageSchema> = await fetchJson(next, PageSchema, auth);
        total = page.total;
        for (const it of page.items) {
          const t = it.track ?? it.item;
          if (!t || !t.id) continue; // titres locaux ou supprimés
          tracks.push({
            title: t.name,
            artists: t.artists.map((a) => a.name),
            album: t.album?.name ?? null,
            durationMs: t.duration_ms,
            isrc: t.external_ids?.isrc ?? null,
            platformId: t.id,
          });
        }
        next = page.next;
      }
      notes.push(`GET /playlists/{id}/${endpoint} OK.`);
      break;
    } catch (e) {
      if (!(e instanceof HttpError)) throw e;
      notes.push(`GET /playlists/{id}/${endpoint} : HTTP ${e.status} ${e.body}`);
    }
  }
  output({ platform: "spotify", url, playlist: { id, name, trackCount: total }, tracks, notes }, "spotify.json");
}

main().catch(fail);

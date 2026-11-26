// Spike SoundCloud : vérifie ce qui est accessible via les voies OFFICIELLES uniquement.
// Pas de scraping de client_id (consigne CLAUDE.md).
// Usage : pnpm tsx soundcloud.ts <lien de playlist>
// Avec des identifiants officiels (app enregistrée, nécessite Artist Pro) :
//   SOUNDCLOUD_CLIENT_ID=... SOUNDCLOUD_CLIENT_SECRET=... pnpm tsx soundcloud.ts <lien>
import { z } from "zod";
import { fail, fetchJson, HttpError, output, requireArg, type SpikeTrack } from "./common.ts";

const API = "https://api.soundcloud.com";

const OEmbedSchema = z.object({ title: z.string(), author_name: z.string().optional(), provider_name: z.string() });
const TokenSchema = z.object({ access_token: z.string() });
const PlaylistSchema = z.object({
  id: z.number(),
  title: z.string(),
  track_count: z.number(),
  tracks: z.array(
    z.object({
      id: z.number(),
      title: z.string(),
      duration: z.number(),
      isrc: z.string().nullable().optional(),
      user: z.object({ username: z.string() }),
      metadata_artist: z.string().nullable().optional(),
    }),
  ),
});

async function main(): Promise<void> {
  const url = requireArg("pnpm tsx soundcloud.ts <lien>");
  const notes: string[] = [];

  // 1) oEmbed : officiel et sans clé, mais ne renvoie que titre + lecteur intégrable.
  const oembed = await fetchJson(`https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(url)}`, OEmbedSchema);
  notes.push(`oEmbed OK (« ${oembed.title} ») : métadonnées de la playlist seulement, aucune liste de titres.`);

  // 2) API officielle sans authentification.
  try {
    await fetchJson(`${API}/resolve?url=${encodeURIComponent(url)}`, z.unknown());
    notes.push("GET /resolve sans auth : OK (inattendu).");
  } catch (e) {
    if (!(e instanceof HttpError)) throw e;
    notes.push(`GET /resolve sans auth : HTTP ${e.status} ${e.body.replace(/\s+/g, " ")}`);
  }

  // 3) Avec identifiants officiels, si fournis : client credentials puis /resolve.
  const id = process.env.SOUNDCLOUD_CLIENT_ID;
  const secret = process.env.SOUNDCLOUD_CLIENT_SECRET;
  const tracks: SpikeTrack[] = [];
  let name: string | null = oembed.title;
  let playlistId = url;
  let count: number | null = null;
  if (!id || !secret) {
    notes.push("SOUNDCLOUD_CLIENT_ID/SECRET absents : lecture des titres impossible sans app officielle.");
  } else {
    const token = await fetchJson("https://secure.soundcloud.com/oauth/token", TokenSchema, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      },
      body: new URLSearchParams({ grant_type: "client_credentials" }),
    });
    const pl = await fetchJson(`${API}/resolve?url=${encodeURIComponent(url)}`, PlaylistSchema, {
      headers: { Authorization: `OAuth ${token.access_token}` },
    });
    name = pl.title;
    playlistId = String(pl.id);
    count = pl.track_count;
    for (const t of pl.tracks) {
      tracks.push({
        title: t.title,
        artists: [t.metadata_artist ?? t.user.username],
        album: null, // pas de notion d'album fiable sur SoundCloud
        durationMs: t.duration,
        isrc: t.isrc ?? null,
        platformId: String(t.id),
      });
    }
    notes.push(`GET /resolve avec token : ${tracks.length} titres.`);
  }
  output({ platform: "soundcloud", url, playlist: { id: playlistId, name, trackCount: count }, tracks, notes }, "soundcloud.json");
}

main().catch(fail);

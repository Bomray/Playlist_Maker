// Spike Deezer : lecture d'une playlist publique via l'API publique, sans clé.
// Usage : pnpm tsx deezer.ts <lien de playlist>
import { z } from "zod";
import { fail, fetchJson, output, requireArg, type SpikeTrack } from "./common.ts";

const API = "https://api.deezer.com";

function parsePlaylistId(url: string): string {
  const m = /playlist\/(\d+)/.exec(url);
  if (!m?.[1]) throw new Error(`Lien Deezer non reconnu : ${url}`);
  return m[1];
}

// Particularité Deezer : les erreurs arrivent en HTTP 200 avec un objet `error`.
const ErrorSchema = z.object({ error: z.object({ type: z.string(), message: z.string(), code: z.number() }) });
const PlaylistSchema = z.union([ErrorSchema, z.object({ id: z.number(), title: z.string(), nb_tracks: z.number(), public: z.boolean() })]);
const PageSchema = z.union([
  ErrorSchema,
  z.object({
    data: z.array(
      z.object({
        id: z.number(),
        title: z.string(),
        duration: z.number(),
        isrc: z.string().optional(),
        readable: z.boolean(),
        artist: z.object({ name: z.string() }),
        album: z.object({ title: z.string() }),
      }),
    ),
    total: z.number(),
    next: z.string().optional(),
  }),
]);

async function main(): Promise<void> {
  const url = requireArg("pnpm tsx deezer.ts <lien>");
  const id = parsePlaylistId(url);
  const notes: string[] = [];
  const pl = await fetchJson(`${API}/playlist/${id}`, PlaylistSchema);
  if ("error" in pl) throw new Error(`Deezer : ${JSON.stringify(pl.error)}`);
  notes.push(`GET /playlist/{id} OK (public : ${pl.public}).`);

  const tracks: SpikeTrack[] = [];
  let next: string | undefined = `${API}/playlist/${id}/tracks?limit=100`;
  let pages = 0;
  while (next) {
    const page: z.infer<typeof PageSchema> = await fetchJson(next, PageSchema);
    if ("error" in page) throw new Error(`Deezer : ${JSON.stringify(page.error)}`);
    pages++;
    for (const t of page.data) {
      tracks.push({
        title: t.title,
        // L'endpoint playlist ne donne que l'artiste principal ; `contributors` exige /track/{id}.
        artists: [t.artist.name],
        album: t.album.title,
        durationMs: t.duration * 1000, // Deezer donne des secondes
        isrc: t.isrc ?? null,
        platformId: String(t.id),
      });
    }
    next = page.next;
  }
  notes.push(`GET /playlist/{id}/tracks OK en ${pages} page(s).`);
  const withIsrc = tracks.filter((t) => t.isrc).length;
  notes.push(`ISRC présent sur ${withIsrc}/${tracks.length} titres.`);
  output({ platform: "deezer", url, playlist: { id, name: pl.title, trackCount: pl.nb_tracks }, tracks, notes }, "deezer.json");
}

main().catch(fail);

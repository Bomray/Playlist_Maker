// Spike 2 — Playlists YouTube / YT Music via l'API officielle YouTube Data v3 (lecture
// et recherche), avec une clé d'API développeur. L'utilisateur final n'a besoin d'aucun compte.
// Usage : pnpm youtube-official "<lien de playlist>" ["recherche"]
// Clé : YOUTUBE_API_KEY dans .env.local, ou injectée par le proxy en session cloud.
import { z } from "zod";
import { fail, fetchJson, HttpError, loadRootEnv, output, requireArg, type SpikeTrack } from "./common.ts";

loadRootEnv();
const API = "https://www.googleapis.com/youtube/v3";
const KEY = process.env.YOUTUBE_API_KEY;
// En-tête plutôt que paramètre `key=` : la clé n'apparaît pas dans les URL (logs, erreurs).
const headers: Record<string, string> = KEY ? { "X-goog-api-key": KEY } : {};

const ItemsPage = z.object({
  items: z.array(
    z.object({
      snippet: z.object({
        title: z.string(),
        videoOwnerChannelTitle: z.string().optional(),
        resourceId: z.object({ videoId: z.string() }),
      }),
      status: z.object({ privacyStatus: z.string() }).optional(),
    }),
  ),
  nextPageToken: z.string().optional(),
  pageInfo: z.object({ totalResults: z.number() }),
});
const Videos = z.object({
  items: z.array(z.object({ id: z.string(), contentDetails: z.object({ duration: z.string() }) })),
});
const Search = z.object({
  items: z.array(z.object({ id: z.object({ videoId: z.string().optional() }), snippet: z.object({ title: z.string(), channelTitle: z.string() }) })),
});

/** « PT3M30S » → 210 000 ms. */
function isoDurationMs(iso: string): number | null {
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!m) return null;
  return ((Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0)) * 60 + Number(m[3] ?? 0)) * 1000;
}

/**
 * Les vidéos « musique » de YT Music appartiennent à une chaîne « Artiste - Topic » ;
 * les clips officiels ont souvent un titre « Artiste - Titre ». On tente les deux.
 */
function guessArtistAndTitle(title: string, channel: string | undefined): { title: string; artists: string[] } {
  if (channel?.endsWith(" - Topic")) return { title, artists: [channel.replace(/ - Topic$/, "")] };
  const dash = /^(.+?)\s[-–]\s(.+)$/.exec(title);
  if (dash?.[1] && dash[2]) return { title: dash[2], artists: [dash[1]] };
  return { title, artists: channel ? [channel] : [] };
}

async function main(): Promise<void> {
  const url = requireArg('pnpm youtube-official "<lien de playlist>" ["recherche"]');
  const query = process.argv[3] ?? "Le goût du sel Bigflo Oli";
  const id = new URL(url).searchParams.get("list");
  if (!id) throw new Error("Lien sans paramètre list=");
  const notes: string[] = [KEY ? "Clé lue dans YOUTUBE_API_KEY." : "Pas de YOUTUBE_API_KEY : clé attendue du proxy (session cloud)."];
  let quota = 0;

  // 1) Titres de la playlist (1 unité par page de 50).
  const raw: z.infer<typeof ItemsPage>["items"] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({ part: "snippet,status", playlistId: id, maxResults: "50" });
    if (pageToken) params.set("pageToken", pageToken);
    const page: z.infer<typeof ItemsPage> = await fetchJson(`${API}/playlistItems?${params}`, ItemsPage, { headers });
    quota += 1;
    raw.push(...page.items);
    pageToken = page.nextPageToken;
  } while (pageToken);
  const privacy = [...new Set(raw.map((i) => i.status?.privacyStatus ?? "?"))];
  notes.push(`playlistItems.list OK : ${raw.length} titres, privacyStatus=${privacy.join(",")}.`);

  // 2) Durées (1 unité par lot de 50 vidéos).
  const durations = new Map<string, number | null>();
  for (let i = 0; i < raw.length; i += 50) {
    const ids = raw.slice(i, i + 50).map((r) => r.snippet.resourceId.videoId);
    const v = await fetchJson(`${API}/videos?part=contentDetails&id=${ids.join(",")}`, Videos, { headers });
    quota += 1;
    for (const item of v.items) durations.set(item.id, isoDurationMs(item.contentDetails.duration));
  }
  notes.push(`videos.list OK : durée connue pour ${[...durations.values()].filter((d) => d !== null).length} vidéos.`);

  const tracks: SpikeTrack[] = raw.map((r) => {
    const guess = guessArtistAndTitle(r.snippet.title, r.snippet.videoOwnerChannelTitle);
    return { ...guess, album: null, durationMs: durations.get(r.snippet.resourceId.videoId) ?? null, isrc: null, platformId: r.snippet.resourceId.videoId };
  });

  // 3) Recherche (100 unités) : nécessaire pour faire de YouTube une destination.
  try {
    const params = new URLSearchParams({ part: "snippet", q: query, type: "video", videoCategoryId: "10", maxResults: "5" });
    const s = await fetchJson(`${API}/search?${params}`, Search, { headers });
    quota += 100;
    notes.push(`search.list OK pour « ${query} » : ${s.items.map((i) => `${i.snippet.title} (${i.snippet.channelTitle})`).join(" | ")}`);
  } catch (e) {
    if (!(e instanceof HttpError)) throw e;
    notes.push(`search.list : HTTP ${e.status} ${e.body.slice(0, 300)}`);
  }
  notes.push(`Quota consommé : environ ${quota} unités sur 10 000 par jour.`);

  output({ platform: "youtube-official", url, playlist: { id, name: null, trackCount: tracks.length }, tracks, notes }, "youtube-official.json");
}

main().catch(fail);

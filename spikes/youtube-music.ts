// Spike YouTube Music : lecture d'une playlist publique via youtubei.js (API interne
// non officielle "InnerTube", sans clé ni compte). Peut casser à tout moment.
// Usage : pnpm tsx youtube-music.ts <lien de playlist>
//
// Constat du spike : depuis l'IP du conteneur cloud, YouTube renvoie les titres
// "grisés" (MUSIC_ITEM_RENDERER_DISPLAY_POLICY_GREY_OUT) : texte seul, sans liens.
// Le parseur de youtubei.js ne remplit alors ni id, ni artistes, ni durée. On lit donc
// la réponse brute de /browse (validée par Zod) en repli.
import { Innertube, YTNodes } from "youtubei.js";
import { z } from "zod";
import { fail, output, requireArg, type SpikeTrack } from "./common.ts";

function parsePlaylistId(url: string): string {
  const id = new URL(url).searchParams.get("list");
  if (!id) throw new Error(`Lien YouTube Music sans paramètre list : ${url}`);
  return id;
}

const Runs = z.object({ runs: z.array(z.object({ text: z.string() })).optional() });
const RawItemSchema = z.object({
  flexColumns: z.array(z.object({ musicResponsiveListItemFlexColumnRenderer: z.object({ text: Runs }) })),
  fixedColumns: z.array(z.object({ musicResponsiveListItemFixedColumnRenderer: z.object({ text: Runs }) })).optional(),
  playlistItemData: z.object({ videoId: z.string() }).optional(),
  musicItemRendererDisplayPolicy: z.string().optional(),
});

/** Parcourt récursivement la réponse et récupère tous les musicResponsiveListItemRenderer. */
function collectRawItems(node: unknown, out: unknown[] = []): unknown[] {
  if (Array.isArray(node)) node.forEach((n) => collectRawItems(n, out));
  else if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) {
      if (k === "musicResponsiveListItemRenderer") out.push(v);
      else collectRawItems(v, out);
    }
  }
  return out;
}

function text(r: z.infer<typeof Runs> | undefined): string {
  return (r?.runs ?? []).map((x) => x.text).join("");
}

function parseDuration(s: string): number | null {
  if (!/^\d+(:\d+)+$/.test(s)) return null;
  return s.split(":").reduce((acc, p) => acc * 60 + Number(p), 0) * 1000;
}

async function main(): Promise<void> {
  const url = requireArg("pnpm tsx youtube-music.ts <lien>");
  const id = parsePlaylistId(url);
  const notes: string[] = [];
  // retrieve_player: false évite de télécharger le lecteur JS (inutile pour lire des métadonnées).
  const yt = await Innertube.create({ retrieve_player: false });

  // 1) Voie normale : le parseur de youtubei.js.
  const playlist = await yt.music.getPlaylist(id);
  const name = playlist.header?.as(YTNodes.MusicResponsiveHeader).title?.text ?? null;
  const parsed = (playlist.items ?? []).map((n) => n.as(YTNodes.MusicResponsiveListItem));
  const withId = parsed.filter((i) => i.id).length;
  notes.push(`youtubei.js music.getPlaylist : ${parsed.length} items, ${withId} avec id, item_type=${parsed[0]?.item_type ?? "?"}.`);
  if (playlist.has_continuation) notes.push("Playlist paginée : continuation non gérée dans le repli brut (spike).");

  // 2) Repli : réponse brute de /browse.
  const raw = await yt.actions.execute("/browse", { browseId: `VL${id}`, client: "YTMUSIC" });
  const items = collectRawItems(raw.data).map((i) => RawItemSchema.parse(i));
  const policies = [...new Set(items.map((i) => i.musicItemRendererDisplayPolicy ?? "aucune"))];
  notes.push(`Réponse brute /browse : ${items.length} items, displayPolicy=${policies.join(",")}.`);

  const tracks: SpikeTrack[] = items.map((i) => {
    const cols = i.flexColumns.map((c) => text(c.musicResponsiveListItemFlexColumnRenderer.text));
    const dur = text(i.fixedColumns?.[0]?.musicResponsiveListItemFixedColumnRenderer.text);
    return {
      title: cols[0] ?? "",
      // Sans liens, les artistes ne sont qu'une chaîne ("A & B", "A, B") : découpage approximatif.
      artists: (cols[1] ?? "").split(/\s*(?:,|&| et | x )\s*/).filter(Boolean),
      album: cols[2] || null,
      durationMs: parseDuration(dur),
      isrc: null, // InnerTube n'expose pas l'ISRC
      platformId: i.playlistItemData?.videoId ?? "",
    };
  });
  notes.push("ISRC non disponible via InnerTube.");
  output({ platform: "youtube-music", url, playlist: { id, name, trackCount: tracks.length }, tracks, notes }, "youtube-music.json");
}

main().catch(fail);

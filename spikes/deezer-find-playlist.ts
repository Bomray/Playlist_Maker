// Cherche des playlists publiques via l'API publique Deezer (sans clé).
// Usage : pnpm tsx deezer-find-playlist.ts "<recherche>"
import { z } from "zod";
import { fail, fetchJson, requireArg } from "./common.ts";

const SearchSchema = z.object({
  data: z.array(
    z.object({
      id: z.number(),
      title: z.string(),
      nb_tracks: z.number(),
      public: z.boolean().optional(),
      link: z.string(),
      user: z.object({ name: z.string() }),
    }),
  ),
  total: z.number(),
});

async function main(): Promise<void> {
  const q = requireArg('pnpm tsx deezer-find-playlist.ts "<recherche>"');
  const res = await fetchJson(`https://api.deezer.com/search/playlist?q=${encodeURIComponent(q)}&limit=10`, SearchSchema);
  console.log(JSON.stringify(res.data.map((p) => ({ id: p.id, title: p.title, nbTracks: p.nb_tracks, owner: p.user.name, link: p.link })), null, 2));
}

main().catch(fail);

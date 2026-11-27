// Spike 2 — Prototype « demande écrite → playlist », SANS appel au modèle d'IA.
// La liste ci-dessous imite la sortie structurée qu'on exigerait du modèle (voir
// RESULTS-2.md) ; deux titres sont inventés exprès, comme une IA peut le faire.
// On vérifie le reste de la chaîne : validation Zod → recherche Spotify → matching.
// Usage : pnpm ai-playlist (session cloud : NODE_USE_ENV_PROXY=1 pnpm ai-playlist)
import { writeFileSync } from "node:fs";
import { z } from "zod";
import { matchTrack } from "../src/core/matching/index.ts";
import type { Track } from "../src/core/models.ts";
import { fail, fetchJson, loadRootEnv } from "./common.ts";

loadRootEnv();

/** Schéma imposé au modèle (sortie structurée) : le même sert à valider sa réponse. */
const GeneratedPlaylist = z.object({
  name: z.string().min(1).max(100),
  tracks: z.array(z.object({ title: z.string().min(1), artist: z.string().min(1) })).min(1).max(50),
});

const REQUEST = "du rap français mélancolique pour courir";
// Ce que le modèle pourrait renvoyer. Les deux dernières entrées sont inventées.
const modelOutput: unknown = {
  name: "Spleen en foulée",
  tracks: [
    { title: "Le goût du sel", artist: "Bigflo & Oli" },
    { title: "Sous une averse", artist: "Lonepsi" },
    { title: "Nekketsu", artist: "Nekfeu" },
    { title: "On verra", artist: "Nekfeu" },
    { title: "La pluie", artist: "Orelsan" },
    { title: "Tout va bien", artist: "Orelsan" },
    { title: "Trop beau", artist: "Lomepal" },
    { title: "Yeux disent", artist: "Lomepal" },
    { title: "Au DD", artist: "PNL" },
    { title: "Onizuka", artist: "PNL" },
    { title: "Désaccordé", artist: "Vald" },
    { title: "Les cendres du matin", artist: "Lomepal" }, // inventé (artiste réel)
    { title: "Courir sous la pluie froide", artist: "Nekfeu" }, // inventé (artiste réel)
  ],
};

const TokenSchema = z.object({ access_token: z.string() });
const SearchSchema = z.object({
  tracks: z.object({
    items: z.array(
      z.object({
        uri: z.string(),
        name: z.string(),
        duration_ms: z.number(),
        artists: z.array(z.object({ name: z.string() })),
        album: z.object({ name: z.string() }),
        external_ids: z.object({ isrc: z.string().optional() }).optional(),
      }),
    ),
  }),
});

async function spotifyToken(): Promise<string> {
  // Client credentials : la recherche du catalogue ne demande aucune connexion utilisateur.
  // En session cloud, le proxy ajoute l'en-tête Basic ; en local, on l'envoie si le secret existe.
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  const headers: Record<string, string> = { "content-type": "application/x-www-form-urlencoded" };
  if (id && secret) headers.Authorization = `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`;
  const t = await fetchJson("https://accounts.spotify.com/api/token", TokenSchema, {
    method: "POST",
    headers,
    body: new URLSearchParams({ grant_type: "client_credentials" }),
  });
  return t.access_token;
}

async function search(token: string, q: string): Promise<Track[]> {
  const params = new URLSearchParams({ q, type: "track", limit: "10", market: "FR" });
  const res = await fetchJson(`https://api.spotify.com/v1/search?${params}`, SearchSchema, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.tracks.items.map((t) => ({
    title: t.name,
    artists: t.artists.map((a) => a.name),
    album: t.album.name,
    durationMs: t.duration_ms,
    isrc: t.external_ids?.isrc ?? null,
    provider: "spotify",
    providerTrackId: t.uri,
  }));
}

async function main(): Promise<void> {
  const playlist = GeneratedPlaylist.parse(modelOutput);
  const token = await spotifyToken();
  const results: { demande: string; statut: string; score: number | null; meilleur: string | null }[] = [];

  for (const { title, artist } of playlist.tracks) {
    // Titre « source » sans ISRC ni durée : seuls titre et artiste comptent dans le score.
    const source: Track = { title, artists: [artist], album: null, durationMs: null, isrc: null, provider: "deezer", providerTrackId: `ia:${title}` };
    const clean = (s: string) => s.replace(/"/g, " ");
    let candidates = await search(token, `track:"${clean(title)}" artist:"${clean(artist)}"`);
    if (candidates.length === 0) candidates = await search(token, `${title} ${artist}`);
    const m = matchTrack(source, candidates);
    results.push({
      demande: `${title} — ${artist}`,
      statut: m.status,
      score: m.best?.score ?? null,
      meilleur: m.best ? `${m.best.track.title} — ${m.best.track.artists.join(", ")}` : null,
    });
  }

  const count = (s: string) => results.filter((r) => r.statut === s).length;
  const summary = { trouvés: count("found"), incertains: count("uncertain"), introuvables: count("not_found") };
  const out = { request: REQUEST, name: playlist.name, summary, results };
  writeFileSync(new URL("./output/ai-playlist.json", import.meta.url), JSON.stringify(out, null, 2) + "\n");
  console.log(JSON.stringify(out, null, 2));
}

main().catch(fail);

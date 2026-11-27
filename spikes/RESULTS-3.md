# Résultats du spike 3 : images (pochettes, photos d'artistes)

Lancé depuis le cloud le 27/11/2026, application en Development Mode, token *client
credentials* (aucune connexion utilisateur). Script : `spikes/images.ts`, sortie :
`output/images.json`.

## Routes

| Route | Résultat | Images |
|---|---|---|
| `GET /tracks/{id}` | ✅ 200 | Pochette 640 / 300 / 64 px, + `artists[].id` et `album.id` |
| `GET /tracks?ids=` (groupé) | ❌ 403 Forbidden | — |
| `GET /artists/{id}` | ✅ 200 | Photo 1000 / 640 / 200 / 64 px |
| `GET /artists?ids=` (groupé) | ❌ 403 Forbidden | — |
| `GET /albums/{id}` | ✅ 200 | Pochette (3 tailles) |
| `GET /albums?ids=` (groupé) | ❌ 403 Forbidden | — |
| `GET /search` (titres, artistes) | ✅ 200 | Images incluses dans chaque résultat |
| oEmbed `open.spotify.com/oembed` (sans clé) | ✅ 200 | Vignette 300 px (titre), 64 px (artiste) ; ~3 req/s |

## Débit

- `GET /tracks/{id}` enchaînés : **300 requêtes en 42 s (~7/s), aucun 429**.
- `GET /artists/{id}` : 40 requêtes en 4,9 s (~8/s), aucun 429.
- oEmbed : 100 requêtes en 29 s (~3/s) : plus lent, moins d'informations (pas d'id d'artiste).

## Conséquences pour l'appli

- **Une requête par titre** (`/tracks/{id}`) donne la pochette et les identifiants Spotify des
  artistes ; puis **une requête par artiste** (`/artists/{id}`) donne sa photo.
- Pour un gros historique (~9 300 titres, ~2 700 artistes) : ~22 min + ~6 min de requêtes,
  **une seule fois**. À faire en tâche de fond (collecte horaire : ~1 700 requêtes par
  exécution sous la limite de 300 s de Vercel), avec une vignette de remplacement en attendant.
- Les nouvelles écoutes (`recently-played`) et la recherche contiennent déjà les images.
- On stocke les **adresses** des images (CDN `i.scdn.co`), pas les fichiers.
- Gérer quand même le 429 (`Retry-After`) : la limite exacte de Spotify n'est pas publiée.

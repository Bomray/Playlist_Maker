# Résultats du spike : API musicales (26 novembre 2026)

Objectif : savoir ce que chaque plateforme permet **réellement** aujourd'hui pour lire
une playlist publique, et ce qu'il faudrait pour écrire, avant d'initialiser l'app.

Tests lancés depuis un conteneur cloud (IP de datacenter, derrière un proxy). Certains
résultats (YouTube surtout) peuvent être différents depuis une IP résidentielle.
Les sorties JSON brutes sont dans [`output/`](./output).

## Synthèse

| Plateforme | Lecture playlist publique | ISRC | Écriture (créer une playlist) | Contraintes principales |
|---|---|---|---|---|
| **Spotify** | ❌ **Non** en client credentials : métadonnées de la playlist OK, mais titres refusés (`401` sur `/items`, `403` sur `/tracks`). Avec un compte utilisateur : seulement ses propres playlists (ou collaboratives) | ✅ via `/tracks/{id}` et `/search?q=isrc:…` (testé) | ✅ **vérifié le 27/11** : OAuth Authorization Code + PKCE, `POST /me/playlists` + `POST /playlists/{id}/items` (voir la mise à jour plus bas) | Dev Mode : 5 utilisateurs max, Premium obligatoire pour le propriétaire de l'app, `/search` limité à `limit=10`, appels groupés (`/tracks?ids=`) en `403` |
| **YouTube Music** | ⚠️ **Partielle** : titre, artistes (texte), album, durée, videoId, en lisant la réponse brute. Le parseur youtubei.js ne remplit plus les champs | ❌ jamais | ⚠️ via YouTube Data API v3 (officielle), OAuth Google, `playlists.insert` + `playlistItems.insert` = 50 unités de quota chacun (10 000/jour) | Pas d'API officielle pour YT Music. Titres « grisés » et **recherche bloquée (`403` anti-bot)** depuis une IP de datacenter |
| **Deezer** | ✅ **Oui**, sans clé, pagination OK (62 et 363 titres) | ✅ dans chaque titre de playlist (62/62, 363/363) | ❌ OAuth avec scope `manage_library`, mais impossible de créer une app (fermé aux particuliers) | Quota ~50 requêtes / 5 s (`code 4 Quota limit exceeded` atteint pendant le spike). Erreurs renvoyées en HTTP 200 |
| **SoundCloud** | ❌ Pas sans app officielle : `/resolve` sans auth → `401` puis `429`. oEmbed (sans clé) donne seulement le titre de la playlist | ⚠️ champ `isrc` dans l'objet track, souvent `null` (non vérifié) | ⚠️ OAuth 2.1 Authorization Code + PKCE, `POST /playlists` (non testé) | Enregistrer une app demande un abonnement **Artist Pro**. Client credentials : 50 tokens / 12 h par app, 30 / h par IP |

## Détail par plateforme

### Spotify — `pnpm spotify <lien>`

Lien testé : `https://open.spotify.com/playlist/2V1Ti24yYnpwKT57BvAKK7` (playlist « L² »).

Ce qui marche (token client credentials) :
- `POST accounts.spotify.com/api/token` avec `grant_type=client_credentials` → 200.
- `GET /v1/playlists/{id}` → 200, mais l'objet ne contient plus de champ `tracks`/`items`
  (seulement nom, description, owner, images…). `?fields=tracks.items(...)` → `{}`.
- `GET /v1/tracks/{id}` → 200, avec `external_ids.isrc`.
- `GET /v1/search?q=isrc:USUM71703861&type=track` → 200 (**recherche par ISRC OK**).
- `GET /v1/albums/{id}/tracks` → 200.

Ce qui échoue :
- `GET /v1/playlists/{id}/items` → `401 {"error": {"status": 401, "message": "Valid user authentication required"}}`
- `GET /v1/playlists/{id}/tracks` → `403 {"error": {"status": 403, "message": "Forbidden"}}`
- Même résultat sur une playlist éditoriale Spotify (`37i9dQZF1DXcBWIGoYBM5M`).
- `GET /v1/tracks?ids=…` (appel groupé) → `403 Forbidden`.
- `GET /v1/search?…&limit=11` (ou plus) → `400 {"error": {"status": 400, "message": "Invalid limit"}}`. Max = 10.

D'après le guide de migration de février 2026 et les retours de développeurs :
`/tracks` a été renommé `/items`, et en Development Mode les titres d'une playlist ne
sont lisibles qu'avec un token utilisateur, et **uniquement pour les playlists que
l'utilisateur possède ou dont il est collaborateur**. Les apps en Extended Quota Mode
ne sont pas concernées, mais ce mode est réservé aux entreprises.

**Conséquence V1** : Spotify ne peut pas servir de **source** pour convertir la
playlist publique de quelqu'un d'autre. Il reste utilisable comme **destination**
(recherche par ISRC + création chez l'utilisateur connecté), dans la limite de
5 utilisateurs.

Écriture (non testé) :
- OAuth 2.0 Authorization Code + PKCE (pas de secret côté client).
- Scopes : `playlist-modify-public` et/ou `playlist-modify-private`.
- `POST /v1/me/playlists` (remplace `POST /users/{id}/playlists`, supprimé), puis
  `POST /v1/playlists/{id}/items` avec des URI `spotify:track:…`.
- Restrictions : 5 utilisateurs autorisés (à déclarer dans le dashboard), Premium pour
  le propriétaire de l'app. Des développeurs signalent des `403` sur l'ajout de titres
  en Dev Mode : **à vérifier avec un spike authentifié avant de s'engager**.

Pièges techniques rencontrés :
- `fetch` de Node n'utilise pas `HTTPS_PROXY` par défaut : sans `NODE_USE_ENV_PROXY=1`,
  la requête part sans le secret injecté par le proxy → `400 {"error":"invalid_client"}`.
  À prévoir dans l'app (variable d'environnement ou agent HTTP explicite).
- Ne pas mettre `client_id` dans le corps quand l'en-tête Basic est ajouté par le proxy.

### YouTube Music — `pnpm youtube-music <lien>`

Lien testé : `https://music.youtube.com/playlist?list=PLSOL9LfGEGu0` (« Test APP », 11 titres).

Bibliothèque JS : **youtubei.js 18.3.0** (client non officiel de l'API interne « InnerTube »).
- `yt.music.getPlaylist()` répond, mais tous les titres reviennent avec
  `MUSIC_ITEM_RENDERER_DISPLAY_POLICY_GREY_OUT` : texte seul, sans liens. Le parseur
  donne alors `item_type: "unknown"`, `id`, `artists`, `album` et `duration` à `undefined`
  (seul `title` est rempli).
- Repli dans le script : lecture de la réponse brute de `/browse`. On y trouve le titre,
  les artistes (une seule chaîne), l'album, la durée et le `videoId`
  (`playlistItemData.videoId`). **Les 11 titres sont récupérés.**
- Limites du repli : les artistes sont une simple chaîne (« Bigflo & Oli » devient
  `["Bigflo", "Oli"]` après découpage), et la pagination n'est pas gérée.
- `yt.music.search()` → **`403`**, page Google « We're sorry... your computer or network
  may be sending automated queries ». La recherche, indispensable pour faire de
  YT Music une destination, ne marche donc pas depuis le cloud.
- ISRC : jamais exposé.

Comparaison avec **ytmusicapi 1.12.4** (Python, `youtube-music.py`) : `get_playlist`
marche mais renvoie aussi `isAvailable: false` et `videoId: null` pour les 11 titres.
`search()` échoue (réponse vide, `JSONDecodeError`). Le problème vient donc de YouTube
(IP de datacenter, pas de session), pas de la bibliothèque JS. Pas d'intérêt à passer
à Python.

Écriture (non testé) :
- Pas d'API officielle YT Music. La voie propre est **YouTube Data API v3** : les
  playlists YouTube apparaissent dans YT Music.
- OAuth 2.0 Google, scope `https://www.googleapis.com/auth/youtube`. Projet Google
  Cloud + écran de consentement (vérification Google nécessaire en production pour ce
  scope sensible, sinon 100 utilisateurs de test max).
- `playlists.insert` (50 unités) + `playlistItems.insert` (50 unités **par titre**).
  Quota par défaut de 10 000 unités/jour, soit environ 190 titres ajoutés par jour pour
  toute l'app. `search.list` coûte 100 unités.
- Autre option : youtubei.js avec cookies de l'utilisateur. Fragile et contraire aux
  conditions d'utilisation. Déconseillé.

### Deezer — `pnpm deezer <lien>` (et `pnpm deezer:find "<recherche>"`)

Playlist trouvée via `GET https://api.deezer.com/search/playlist?q=french rap` :
`https://www.deezer.com/playlist/16006480463` (« French rap », 62 titres, publique).
Vérifié aussi sur `9723758162` (363 titres, 4 pages).

Ce qui marche, **sans clé ni compte** :
- `GET /playlist/{id}` et `GET /playlist/{id}/tracks?limit=100` (pagination par `next`).
- Chaque titre contient : `id`, `title`, `duration` (secondes), `isrc`, `artist.name`,
  `album.title`. **ISRC présent sur 100 % des titres testés.**
- `GET /track/isrc:{ISRC}` → 200 : recherche directe par ISRC.
- `GET /search?q=artist:"…" track:"…"` : recherche avancée.

Limites :
- Seul l'artiste principal est donné ; les featurings demandent `GET /track/{id}`
  (`contributors`).
- Les erreurs arrivent en **HTTP 200** avec un objet `error`, par ex.
  `{"error":{"type":"DataException","message":"no data","code":800}}` (playlist inconnue)
  ou `{"error":{"type":"Exception","message":"Quota limit exceeded","code":4}}`
  (atteint pendant le spike, après quelques dizaines d'appels rapides ; levé en
  quelques secondes). Il faudra un limiteur de débit côté app.

Écriture (non testé) : OAuth Deezer, permissions `manage_library` (+ `offline_access`),
`POST /user/me/playlists` puis `POST /playlist/{id}/tracks`. **Bloqué** : la création de
nouvelles applications Deezer est fermée aux particuliers. Deezer = **lecture seule**.

### SoundCloud — `pnpm soundcloud <lien>`

Playlist publique utilisée : `https://soundcloud.com/forss/sets/soulhack` (exemple de la
doc SoundCloud, existence confirmée par oEmbed). Sans compte, impossible d'en trouver une
autre de façon fiable : les pages soundcloud.com sont rendues côté client (titre HTML
générique, même pour une URL inexistante), et trouver mieux demanderait de scraper.

Ce qui marche :
- `GET https://soundcloud.com/oembed?format=json&url=…` → 200, mais seulement titre,
  description et code du lecteur intégrable. **Aucune liste de titres.**

Ce qui échoue :
- `GET https://api.soundcloud.com/resolve?url=…` sans auth → `401` au premier essai,
  puis `429 {"error": "Rate Limit Exceeded"}` (IP partagée du proxy).
- developers.soundcloud.com n'est pas joignable depuis le conteneur (bloqué par le réseau) :
  infos ci-dessous tirées de recherches web.

Accès officiel :
- Enregistrer une app (page « Your Apps » ou CLI `sc-api-auth`) demande un abonnement
  **Artist Pro** (payant). Pas de clé ici, donc lecture des titres non testée. Le
  script la gère si on fournit `SOUNDCLOUD_CLIENT_ID` et `SOUNDCLOUD_CLIENT_SECRET`.
- Client credentials : ressources publiques seulement (résolution d'URL, recherche),
  50 tokens / 12 h par app, 30 tokens / h par IP (il faut donc mettre le token en cache).
- ISRC : champ `isrc` dans l'objet track, souvent `null` (renseigné par l'uploader).
- Écriture (non testé) : OAuth 2.1 Authorization Code + PKCE, en-tête
  `Authorization: OAuth <token>`, `POST /playlists` (titre, `sharing`, liste de titres).
- Le catalogue SoundCloud (remixes, sons d'artistes indépendants) recoupe mal celui des
  autres plateformes : beaucoup de titres introuvables dans les deux sens.

## Recommandation pour la V1

**Commencer par Deezer (source) → Spotify (destination).**

1. **Deezer** est la seule plateforme où la lecture d'une playlist publique marche
   aujourd'hui, sans clé, avec un ISRC pour chaque titre. C'est la source idéale pour
   valider tout le pipeline (`parsePlaylistUrl`, `getPlaylist`, matching ISRC, récap
   trouvés / incertains / introuvables).
2. **Spotify** est la seule destination réaliste : la recherche par ISRC marche déjà
   en client credentials, donc le matching sera très fiable. La création demande
   un OAuth utilisateur (PKCE), dans la limite de 5 utilisateurs. **Avant de coder le
   provider : un petit spike authentifié** pour confirmer `POST /me/playlists` et
   `POST /playlists/{id}/items` en Dev Mode (des `403` sont signalés).

Pour la suite :
- **YouTube Music** : en troisième. Lecture possible (fragile), mais recherche bloquée
  depuis un serveur cloud et écriture limitée par le quota de YouTube Data API. À
  isoler complètement comme prévu, et à retester depuis l'hébergement final.
- **SoundCloud** : à mettre de côté tant qu'on n'a pas d'abonnement Artist Pro.
- **Spotify comme source** : seulement pour les playlists de l'utilisateur connecté
  (OAuth), pas pour un lien public quelconque. Il faut l'indiquer clairement dans l'UI
  (erreur typée « playlist non accessible »).

## Mise à jour du 27 novembre 2026 : écriture Spotify vérifiée

Test authentifié depuis l'app (page temporaire `/dev/spotify`, IP résidentielle,
compte déclaré dans « User Management »), en **Development Mode** :

- OAuth Authorization Code + PKCE, scopes `playlist-modify-private playlist-read-private`,
  échange du code avec l'en-tête Basic (secret défini) : OK.
- `GET /v1/search?q=isrc:USUM71703861&type=track&limit=1` avec le token utilisateur :
  OK (« Cut To The Feeling », Carly Rae Jepsen).
- `POST /v1/me/playlists` (`public: false`, avec description) : OK, playlist privée créée.
- `POST /v1/playlists/{id}/items` avec `{ "uris": ["spotify:track:…"] }` : OK, titre ajouté.

Les `403` signalés par d'autres développeurs ne se produisent pas ici. **Spotify est
confirmé comme destination V1.**

Vérification du provider Spotify (même jour, `/dev/spotify`) :

- `GET /v1/search?…&market=from_token` → **`403 Insufficient client scope`** sans le scope
  `user-read-private`. Avec ce scope : OK, recherche par ISRC et par
  `track:"…" artist:"…"` (titre sans ISRC trouvé).
- Création d'une playlist avec 2 titres puis relecture via `GET /v1/playlists/{id}/items` :
  OK pour une playlist de l'utilisateur.
- `GET /v1/playlists/37i9dQZF1DXcBWIGoYBM5M` (« Today's Top Hits », éditoriale Spotify) →
  **`404 Resource not found`** : les playlists créées par Spotify sont bloquées pour les
  nouvelles applications.

## Comment relancer

```bash
cd spikes
pnpm install
pnpm spotify "https://open.spotify.com/playlist/2V1Ti24yYnpwKT57BvAKK7"
pnpm deezer "https://www.deezer.com/playlist/16006480463"
pnpm youtube-music "https://music.youtube.com/playlist?list=PLSOL9LfGEGu0"
pnpm soundcloud "https://soundcloud.com/forss/sets/soulhack"
pnpm typecheck
# Comparaison Python (facultatif) :
python3 -m venv .venv && .venv/bin/pip install ytmusicapi
.venv/bin/python youtube-music.py "https://music.youtube.com/playlist?list=PLSOL9LfGEGu0"
```

Les scripts `pnpm` définissent `NODE_USE_ENV_PROXY=1` (nécessaire en session cloud,
sans effet ailleurs si aucun proxy n'est configuré).

## Sources consultées (documentation non joignable depuis le conteneur)

- [Spotify — February 2026 Web API Dev Mode Changes, Migration Guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide)
- [Spotify — Web API Changelog, February 2026](https://developer.spotify.com/documentation/web-api/references/changes/february-2026)
- [Spotify Community — Playlist creation returns 403 in Development Mode](https://community.spotify.com/t5/Spotify-for-Developers/Web-API-playlist-creation-returns-403-in-Development-Mode-no/td-p/7482480)
- [rspotify — Spotify Web API changes (February 2026)](https://github.com/ramsayleung/rspotify/issues/550)
- [SoundCloud — Get an API key](https://developers.soundcloud.com/docs/api/register-app)
- [SoundCloud — API Guide](https://developers.soundcloud.com/docs/api/guide)
- [SoundCloud — New API Track Object](https://developers.soundcloud.com/blog/soundclouds-new-api-track-object)
- [YouTube Data API — Quota costs](https://developers.google.com/youtube/v3/determine_quota_cost)
- [YouTube Data API — Playlists: insert](https://developers.google.com/youtube/v3/docs/playlists/insert)

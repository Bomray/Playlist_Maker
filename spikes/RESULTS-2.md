# Résultats du spike 2 : stats, IA, API YouTube officielle

Question : l'appli garde-t-elle son intérêt malgré les limites des API ? On vérifie ce
qui permettrait la **génération de playlists par IA**, les **stats d'écoute** et la
**connexion à YouTube Music**, avec un principe décidé en cours de route :
**l'utilisateur final ne crée aucun compte supplémentaire** (voir CLAUDE.md).

> Statut : complet, sauf l'écriture YouTube (⏳), bloquée tant que le compte de test n'est
> pas déclaré dans Google Cloud (voir § 4).

## Synthèse

| Fonctionnalité | Faisable ? | Compte pour l'utilisateur | Clé développeur | Limites principales |
|---|---|---|---|---|
| Génération de playlist par IA → Spotify | ✅ Chaîne vérifiée (sauf l'appel au modèle) | Spotify (déjà) | Clé API Claude (payante) | Les titres inventés par l'IA doivent être détectés (voir ci-dessous) |
| Stats Spotify via l'API | ✅ Tops titres et artistes sur 3 périodes | Spotify (déjà) | Spotify (déjà) | Historique récent limité aux **50 dernières écoutes** ; genres vides |
| Stats par import des exports | 📄 Documenté, pas testé | Aucun (fichier) | Aucune | Délai de plusieurs jours à ~30 jours pour obtenir l'export |
| Lecture YouTube Music (API officielle) | ✅ **11/11 titres**, artiste et durée corrects | Aucun (playlist publique) | Projet Google Cloud (gratuit) | Pas d'album ni d'ISRC. Quota : ~2 unités pour 50 titres |
| Recherche YouTube (API officielle) | ⚠️ Marche, mais résultats bruités | Aucun | Projet Google Cloud | **100 unités par recherche** → ~100 recherches par jour pour toute l'appli |
| Écriture YouTube Music (API officielle) | ⏳ Bloquée en mode test (`403 access_denied`) | Google (déjà) | Projet Google Cloud + OAuth | 50 unités par playlist + 50 par titre ; vérification Google pour sortir du mode test |
| Stats unifiées via Last.fm | ❌ Écarté | Last.fm (à créer) | Clé Last.fm | Contraire au principe : chaque utilisateur devrait créer un compte |

## 1. Prototype « demande écrite → playlist » — `pnpm ai-playlist` ✅

Lancé depuis le cloud le 27/11/2026. Sortie complète : [`output/ai-playlist.json`](./output/ai-playlist.json).

Chaîne testée : liste au format imposé au modèle (validée par Zod) → recherche Spotify en
*client credentials* (aucune connexion utilisateur) → `matchTrack` de `src/core/matching`.
La liste imite une sortie de modèle pour « du rap français mélancolique pour courir », avec
**2 titres inventés** exprès, d'artistes réels (le cas le plus piégeux).

| | Résultat |
|---|---|
| 11 titres réels | **11 trouvés**, score 1,00 (y compris « La pluie » → « La pluie (feat. Stromae) ») |
| « Courir sous la pluie froide » — Nekfeu (inventé) | **introuvable** (0,49, meilleur candidat « Plume ») |
| « Les cendres du matin » — Lomepal (inventé) | **incertain** (0,65, meilleur candidat « Decrescendo ») |

Conclusion : aucun titre inventé n'est ajouté automatiquement, car un « incertain » demande
une validation. Mais le 2ᵉ cas montre une faiblesse : **sans durée** (une IA n'en donne pas),
le poids de la durée est reporté sur le titre et l'artiste. Un artiste exact suffit alors
presque à atteindre « incertain ».

**À corriger avant la fonctionnalité IA** : pour une source sans durée, exiger une
similarité de titre minimale (par ex. ≥ 0,6) pour classer « incertain ». Sinon :
« introuvable ».

### Appel au modèle (documenté, non testé : pas de clé)

- SDK officiel `@anthropic-ai/sdk`, modèle `claude-opus-5-5` (modèle par défaut recommandé).
- **Sortie structurée** : `client.messages.parse({ ..., output_config: { format: zodOutputFormat(GeneratedPlaylist) } })`
  avec le même schéma Zod que le prototype (`{ name, tracks: [{ title, artist }] }`). La
  réponse est validée par le SDK (`parsed_output`), pas de JSON à extraire du texte.
- Consigne : ne proposer que des titres réellement existants, et ne pas inventer de version.
  Le matching reste le filet de sécurité.
- **Coût estimé** pour une playlist de 30 titres : ~500 jetons en entrée + ~1 500 en sortie
  (réflexion comprise, effort `low` suffisant pour cette tâche) ≈ 0,002 $ + 0,03 $ ≈
  **0,03 € par playlist** au tarif d'Opus 5.5 (4 $ / 20 $ par million de jetons).
  À mesurer pour de vrai.
- Clé API Claude côté développeur seulement : invisible pour l'utilisateur.

## 2. Stats Spotify via l'API — `pnpm spotify-stats` ✅

Lancé sur le PC le 27/11/2026, avec le compte Spotify existant (scopes `user-top-read` et
`user-read-recently-played`, Development Mode). Sortie, sans les titres personnels :
[`output/spotify-stats.json`](./output/spotify-stats.json).

| Requête | Résultat |
|---|---|
| `/me/top/tracks`, `short_term` (~4 semaines) | ✅ 50 titres, ISRC sur 50 |
| `/me/top/tracks`, `medium_term` (~6 mois) | ✅ 50 titres, ISRC sur 50 |
| `/me/top/tracks`, `long_term` (~1 an) | ✅ 50 titres, ISRC sur 50 |
| `/me/top/artists`, `medium_term` | ✅ 50 artistes, mais **genres vides sur les 50** |
| `/me/player/recently-played` | ✅ 50 écoutes, puis **0** en remontant avec `before` |

Ce que ça permet :
- **Tops personnels** (« ton top du mois / de l'année »), tout de suite, sans base de données.
- L'ISRC sur chaque titre permet de croiser avec les autres plateformes.

Limites :
- **Historique détaillé : seulement les 50 dernières écoutes** (ici environ 8 h). Pour des
  stats « vraies » (temps d'écoute, évolution), il faudrait interroger cette route
  régulièrement (au moins toutes les quelques heures) et **stocker** les écoutes. Cela
  demande une base de données et une tâche planifiée, ou l'import des exports (§ 3).
- **Genres vides** : Spotify ne les fournit plus. Pour des filtres ou stats par genre, il
  faudra une autre source, par exemple demander à l'IA de classer les artistes.

## 3. Stats par import des exports de données 📄

Pas de script : impossible à tester sans un vrai fichier. Formats connus (à confirmer avec
un vrai export) :

- **Spotify**, depuis la page Confidentialité du compte :
  - « Données du compte » (environ 5 jours) : `StreamingHistory_music_*.json` sur un an,
    avec `endTime`, `artistName`, `trackName` et `msPlayed` ;
  - « Historique de streaming étendu » (jusqu'à ~30 jours) : tout l'historique depuis la
    création du compte, avec `ts`, `ms_played`, `master_metadata_track_name`,
    `master_metadata_album_artist_name`, `master_metadata_album_album_name`,
    `spotify_track_uri`, `skipped`, `shuffle`…
- **Deezer** : export RGPD depuis les paramètres du compte (« Mes données personnelles »).
  Format et contenu de l'historique **à vérifier**.
- **YouTube / YT Music** : Google Takeout, « Historique YouTube et YouTube Music »
  (`watch-history.json`), avec titre, lien, chaîne et date. Les écoutes YT Music sont
  marquées `"header": "YouTube Music"`.

Combinaison visée : **API Spotify pour le récent + import pour l'historique complet**. Les
stats YouTube et Deezer ne seraient possibles que par import.

## 4. YouTube via l'API officielle

### Lecture et recherche — `pnpm youtube-official` ✅

Lancé sur le PC le 27/11/2026, avec la clé développeur dans `.env.local`. Sortie :
[`output/youtube-official.json`](./output/youtube-official.json).

**Lecture : bien meilleure que youtubei.js au spike 1.**
- `playlistItems.list` + `videos.list` : **11/11 titres** avec titre, artiste, durée et
  videoId, en ~2 unités de quota.
- Pas de titres « grisés » : on n'est plus lié à l'IP ni à une API interne qui peut casser.
- La règle « chaîne `Artiste - Topic` → artiste » a donné le bon artiste sur les 11 titres,
  y compris « Bigflo & Oli » (non découpé) et le titre à tiret « Jamais rentré - Nouvelle
  École x CUPRA ».
- Manquent : l'album et l'ISRC. Le matching vers Spotify se fera donc par score (titre,
  artiste, durée), comme pour le contrôle de réalisme de l'étape 4, qui avait trouvé 11/11.

**Recherche : elle marche, mais elle coûte cher et elle est bruitée.**
- `search.list` répond, alors qu'InnerTube était bloqué au spike 1.
- Les résultats mélangent la vidéo officielle, des copies (« LYRICS », « 8D MUSIC ») et
  d'autres titres du même artiste. Les titres arrivent échappés en HTML (`&amp;`).
- Coût : **100 unités par recherche**. Avec 10 000 unités par jour **pour toute l'appli**,
  c'est environ 100 titres cherchés par jour. En ajoutant l'insertion (50 unités par titre),
  une conversion vers YouTube coûte ~150 unités par titre : **~65 titres par jour, soit
  2 playlists de 30 titres** pour toute l'appli.

**Conséquence** : **YouTube Music comme source** (YT Music → Spotify) est faisable
proprement dès maintenant. **Comme destination**, c'est limité par le quota : à réserver
à un petit nombre d'utilisateurs, ou après avoir obtenu une augmentation de quota
(formulaire d'audit Google). Il faudrait aussi préférer les résultats des chaînes « - Topic ».

### Écriture — `pnpm youtube-write` ⏳

Lancé sur le PC le 27/11/2026 : bloqué à la connexion Google, avec la page « Accès bloqué :
Playlist Maker n'a pas terminé la procédure de validation de Google » et
**`Erreur 403 : access_denied`**.

Cause : le projet Google Cloud est en mode **Test**, où seuls les « utilisateurs test »
déclarés peuvent se connecter (100 au maximum). À faire : Google Auth Platform → Audience
→ Utilisateurs test → ajouter le compte, puis relancer.

Pour un usage public, il faudra **faire valider l'appli par Google**, car le scope
`youtube` est sensible (procédure de vérification à confirmer). C'est l'équivalent du
plafond de 5 utilisateurs de Spotify, mais avec une porte de sortie.

Note technique : le secret réseau de la session cloud ne peut pas être envoyé dans
l'en-tête `X-goog-api-key` (seuls certains formats d'en-tête sont acceptés). La clé passe
donc par `.env.local` et le script est lancé sur le PC.

## Recommandation

**L'appli garde son intérêt, à condition d'en faire un « assistant musical » centré sur
le compte Spotify de l'utilisateur, plutôt qu'un convertisseur universel.**

Ce qui marche aujourd'hui, sans aucun compte en plus pour l'utilisateur :

| Fonctionnalité | État |
|---|---|
| Conversion Deezer → Spotify | ✅ Livrée (V1) |
| Conversion YouTube Music → Spotify | ✅ Faisable proprement avec l'API officielle (lecture vérifiée 11/11) |
| Génération de playlist par IA → Spotify | ✅ Chaîne vérifiée, ~0,03 € par playlist, titres inventés détectés |
| Tops personnels (mois, 6 mois, année) | ✅ API Spotify, sans base de données |
| Historique complet et stats détaillées | 📄 Par import des exports (Spotify, Google), ou par collecte régulière avec stockage |
| Conversion Spotify → YouTube Music | ⚠️ Possible mais ~2 playlists de 30 titres par jour pour toute l'appli (quota) |

Ce qui reste hors de portée pour un **site public** :
- **Spotify en Development Mode : 5 utilisateurs maximum.** C'est la vraie limite du projet.
  Pour un usage personnel ou entre amis, aucun problème.
- Deezer et SoundCloud en écriture.

**Ordre proposé** :
1. **Terminer la V1 avec YouTube Music comme 2ᵉ source** : provider `youtube-music` sur
   l'API officielle (clé développeur, lecture seule, petit quota), avec le même écran de
   conversion.
2. **Génération de playlist par IA** : le plus fort intérêt pour un effort raisonnable,
   puisque matching, récap et création existent déjà. Avant ça : corriger le score des
   sources sans durée (§ 1).
3. **Stats** : d'abord les tops Spotify (sans stockage), puis l'import des exports pour
   l'historique complet. La collecte régulière viendrait seulement si une base de données
   est ajoutée (décision à prendre plus tard).

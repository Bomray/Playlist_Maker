# Résultats du spike 2 : stats, IA, API YouTube officielle

Question : l'appli garde-t-elle son intérêt malgré les limites des API ? On vérifie ce
qui permettrait la **génération de playlists par IA**, les **stats d'écoute** et la
**connexion à YouTube Music**, avec un principe décidé en cours de route :
**l'utilisateur final ne crée aucun compte supplémentaire** (voir CLAUDE.md).

> Statut : brouillon. Les sections marquées ⏳ attendent les scripts lancés sur le PC
> (connexion dans le navigateur ou clé développeur Google).

## Synthèse (provisoire)

| Fonctionnalité | Faisable ? | Compte pour l'utilisateur | Clé développeur | Limites principales |
|---|---|---|---|---|
| Génération de playlist par IA → Spotify | ✅ Chaîne vérifiée (sauf l'appel au modèle) | Spotify (déjà) | Clé API Claude (payante) | Les titres inventés par l'IA doivent être détectés (voir ci-dessous) |
| Stats Spotify via l'API | ⏳ | Spotify (déjà) | Spotify (déjà) | ⏳ |
| Stats par import des exports | 📄 Documenté, pas testé | Aucun (fichier) | Aucune | Délai de plusieurs jours à ~30 jours pour obtenir l'export |
| Lecture YouTube Music (API officielle) | ⏳ | Aucun (playlist publique) | Projet Google Cloud (gratuit) | Quota : 1 unité par page de 50 titres |
| Écriture YouTube Music (API officielle) | ⏳ | Google (déjà) | Projet Google Cloud + OAuth | 100 unités par playlist + 50 par titre, sur 10 000 par jour |
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

## 2. Stats Spotify via l'API — `pnpm spotify-stats` ⏳

À lancer sur le PC (connexion Spotify dans le navigateur, app arrêtée). Le script teste
`/me/top/tracks` (3 périodes), `/me/top/artists` et `/me/player/recently-played` (avec
pagination, pour voir jusqu'où remonte l'historique).

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

## 4. YouTube via l'API officielle — `pnpm youtube-official` / `pnpm youtube-write` ⏳

Lecture (`playlistItems.list`, `videos.list`) et recherche (`search.list`) avec la clé
développeur ; écriture (`playlists.insert`, `playlistItems.insert`) avec le compte Google
existant de l'utilisateur.

Note technique : le secret réseau de la session cloud ne peut pas être envoyé dans
l'en-tête `X-goog-api-key` (seuls certains formats d'en-tête sont acceptés). La clé passe
donc par `.env.local` et le script est lancé sur le PC.

## Recommandation (provisoire)

À compléter avec les résultats ⏳.

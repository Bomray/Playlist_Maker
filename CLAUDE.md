# CLAUDE.md

Ce fichier est lu par Claude au début de chaque session. Garde-le court et à jour :
quand une décision change, change-la ici.

## Le projet

**Wavl** (wave + vinyl / level ; dépôt `Playlist_Maker`) : application web (responsive, puis
installable en PWA) de stats d'écoute Spotify et de conversion de playlists entre plateformes.

- **V1 (en cours)** : convertir une playlist d'une plateforme vers une autre en un clic,
  à partir de son lien. Plateformes visées : Spotify, YouTube Music, Deezer, SoundCloud.
  Pas de comptes propres à l'appli : on se connecte avec Spotify (utilisateur en base).
- **Principe : l'utilisateur final ne crée aucun compte supplémentaire.** Il se connecte
  seulement avec ses comptes existants (Spotify, Google/YouTube…). Les clés développeur
  (Spotify, Google Cloud…) sont créées une fois par le développeur et restent invisibles.
  Donc pas de Last.fm ni d'autre service tiers à rejoindre pour utiliser l'appli.
- **Plus tard** : génération de playlists à partir d'une demande écrite (IA),
  statistiques d'écoute multi-plateformes, filtres personnalisés sauvegardables.
  Ne rien construire pour ces fonctionnalités tant que la V1 n'est pas terminée.
  - **Stats voulues** : temps d'écoute (minutes, heures, jours) et nombre d'écoutes, par titre,
    artiste et période. Sources décidées : **import de l'export Spotify** (« Historique de
    streaming étendu », champ `ms_played`) pour le passé, puis **enregistrement continu des
    nouvelles écoutes** (`/me/player/recently-played` ne garde que les 50 dernières : il faut
    l'interroger régulièrement et stocker). Architecture décidée dans
    `docs/decisions/0002-enregistrement-continu-des-ecoutes.md`.

### Avancement de la V1 (Deezer → Spotify)

1. ✅ App initialisée, CI, connexion Spotify PKCE (cookie chiffré).
2. ✅ Provider Deezer (lecture seule, limiteur de débit).
3. ✅ Provider Spotify (recherche, création, lecture de ses propres playlists).
4. ✅ `core/matching` + `core/convert.ts` : normalisation, score de confiance (ISRC, sinon
   titre 0,5 / artiste 0,3 / durée 0,2 ; trouvé ≥ 0,85, incertain ≥ 0,5), rapport de conversion,
   correction manuelle. Les incertains ne sont pas ajoutés sans validation.
5. Conversion de bout en bout, en deux PR :
   - ✅ 5a. Serveur : liens courts Deezer (`expandUrl`), `POST /api/convert` (progression en flux
     NDJSON, voir `lib/conversion-stream.ts`), Server Actions de recherche manuelle et de création.
   - ✅ 5b. Interface sur l'accueil (`components/conversion/`) : lien → progression → récap
     (trouvés / incertains / introuvables) → correction → création. `/dev/spotify` supprimée.
6. ✅ YouTube Music comme 2ᵉ source (`providers/youtube-music/`, API officielle, lecture seule).
7. Stats d'écoute (choisies avant l'IA, qui demande une clé payante) :
   - ✅ 7a. Page `/stats` : import de l'export Spotify (.zip ou .json) lu **dans le navigateur**
     (Web Worker ; sans connexion rien n'est envoyé), calculs dans `core/stats/` (temps total, écoutes ≥ 30 s,
     tops, années / mois / jours / heures dans le fuseau local, podcasts à part).
   - ✅ 7b. Enregistrement continu des nouvelles écoutes, décidé dans
     `docs/decisions/0002-enregistrement-continu-des-ecoutes.md` : **Vercel** (hébergement),
     **Neon** (PostgreSQL : utilisateurs, tokens chiffrés, historique importé et écoutes),
     **GitHub Actions** toutes les heures → `POST /api/cron/collect`. Quatre PR :
     - ✅ Mise en ligne : https://playlist-maker-bomray.vercel.app
     - ✅ Base et session en base : `src/lib/db/` (pilote Neon, requêtes SQL à la main,
       migrations `db/migrations/*.sql` appliquées au build de production), table `users`,
       tokens chiffrés (`TOKEN_ENCRYPTION_KEY`), cookie `pm_session` = identifiant seul
       (`providers/spotify/session.ts`, `account.ts`). Tests SQL avec PGlite ; e2e sur un
       serveur dédié (port 3100, base PGlite préremplie par `scripts/e2e-seed.mts`).
     - ✅ Import de l'export vers la base : tables `tracks` / `plays` (migration 0002, clé
       d'unicité `(user_id, ended_at, track_id, ms_played, offline_ts)` mesurée sur un vrai
       export), `POST /api/stats/import` par lots de 5 000, `GET /api/stats/history` (flux
       NDJSON paginé) et `DELETE` (suppression des données). Le worker télécharge l'historique
       et calcule les stats dans le navigateur (`components/stats/account-sync.ts`).
     - ✅ Collecte toutes les heures : `.github/workflows/collect.yml` (minute 17) →
       `POST /api/cron/collect` (secret `CRON_SECRET`, réponse = compteurs seulement, car les
       journaux d'un dépôt public sont visibles), `providers/spotify/collector.ts` (curseur
       `after`, origine `api`, durée = durée du morceau). Accord par l'interrupteur de `/stats`
       (`/api/stats/collect`, première collecte immédiate). Règle « l'export fait foi » : à la
       lecture, les écoutes `api` sur la période couverte par l'import sont ignorées.
8. ⏭️ Refonte et stats v2 (demandées le 27/11/2026, dans cet ordre) :
   - ✅ Spike images (`spikes/RESULTS-3.md`) : routes unitaires `/tracks/{id}` et
     `/artists/{id}` OK (~7 req/s sans 429), routes groupées `?ids=` en 403. Images à remplir
     en tâche de fond et à mettre en cache en base (adresses `i.scdn.co`).
   - ⏭️ Refonte graphique, d'après la maquette finale choisie (artifact « Maquettes Playlist
     Maker », écrans `FIN-*`) : base « P » (aurore, verre dépoli, mosaïque de pochettes),
     **violet parme**, thème sombre et clair, logo « disque fendu B » (vinyle fendu par une
     onde en W), **minutes par défaut** avec bascule heures partout où une durée s'affiche,
     pages qui défilent (pas d'écran figé). Six PR :
     - ✅ 1. Thème et base : nom Wavl, logo (`components/brand/logo.tsx`, `app/icon.svg`),
       couleurs et classe `dark` (`lib/theme.ts`, bouton système → sombre → clair), aurore,
       en-tête en verre et barre du bas sur téléphone (`components/layout/`). Accueil `/` =
       stats, conversion sur `/convertir`, `/stats` redirige vers `/`.
     - ✅ 2. Page Stats : périodes dans `core/stats/period.ts` (aujourd'hui … plage libre),
       `byDay` + `core/stats/evolution.ts` (courbe par jour / semaine / mois, calendrier),
       préférence minutes / heures (`components/stats/use-duration-unit.tsx`, clé
       `wavl-duration-unit`), mosaïque des n°1 (dégradés en attendant les images), minuteur
       `core/stats/schedule.ts` (minute 17 UTC ; attente et rechargement si le relevé tarde).
     - ✅ 3. Images : migration 0003 (`tracks.image_url`, table `artists`), remplissage par
       `POST /api/cron/images` (2ᵉ étape de `collect.yml`, 4 min max, token d'application,
       ~6 req/s, arrêt sur 429, les plus écoutés d'abord), lecture par `POST /api/stats/images`
       (connecté), affichage `components/stats/images.tsx` (fondu sur le dégradé).
     - 4. Pages artiste, album et titre : courbe d'évolution et calendrier jour par jour.
     - 5. Tops complets : recherche, onglets titres / artistes / albums, chargement au défilement.
     - 6. Conversion au nouveau style (pochettes qui se retournent quand un titre est trouvé).
   - Stats v2 (dans les PR ci-dessus) : **sélecteur de période global** (aujourd'hui, hier,
     7 jours, mois, 6 mois, année, année précise, tout, plage libre) ; tops complets ; pages
     artiste, album et titre ; images sur titres, albums et artistes.
   - Ensuite : notes sur 10 (titre, album, artiste ; moyenne des titres ou note fixée),
     autres idées de fonctionnalités, puis génération de playlist par IA (clé payante ;
     corriger d'abord le score des sources sans durée, voir `spikes/RESULTS-2.md`).

Mettre cette liste à jour à chaque PR fusionnée.

Développeur : étudiant en BUT Informatique. Explique brièvement les choix
non évidents (dans la PR ou en commentaire), sans cours magistral.

## Stack

- TypeScript strict partout (`"strict": true`, pas de `any` sauf justification en commentaire)
- Next.js (App Router), React, Tailwind CSS, composants shadcn/ui
- pnpm comme gestionnaire de paquets
- Vitest pour les tests unitaires, Playwright pour les tests de bout en bout
- ESLint + Prettier
- Validation des données externes avec Zod (toute réponse d'API tierce est validée)

Ne pas ajouter de nouvelle dépendance importante sans l'expliquer dans la PR.

## Commandes

```bash
pnpm install        # dépendances
pnpm dev            # serveur de dev (http://127.0.0.1:3000)
pnpm test           # tests unitaires (Vitest)
pnpm test:e2e       # tests Playwright
pnpm lint           # ESLint
pnpm typecheck      # tsc --noEmit
pnpm db:migrate     # migrations SQL sur DATABASE_URL (Neon)
```

Avant de considérer une tâche terminée : `pnpm lint && pnpm typecheck && pnpm test` passent.

## Architecture

```
src/
  app/                  # routes et pages Next.js (UI uniquement, pas de logique métier)
  components/           # composants UI réutilisables
  core/                 # logique métier pure, SANS dépendance à Next.js ni aux API
    models.ts           # Track, Playlist, ProviderId...
    matching/           # correspondance de titres entre plateformes
    convert.ts          # orchestration d'une conversion
  providers/            # un dossier par plateforme
    types.ts            # interface MusicProvider
    spotify/
    youtube-music/
    deezer/
    soundcloud/
  lib/                  # utilitaires techniques (http, cache, logs)
spikes/                 # scripts d'exploration jetables, hors build
docs/decisions/         # notes de décision courtes (ADR), une par choix important
```

### Règles

- **Interface commune** : chaque plateforme implémente `MusicProvider`
  (`parsePlaylistUrl`, `getPlaylist`, `searchTrack`, `createPlaylist`).
  Le reste du code ne connaît que cette interface, jamais une API précise.
- **`core/` ne dépend de rien** : testable sans réseau. Les providers sont
  injectés, et mockés dans les tests.
- **Correspondance des titres** : d'abord par ISRC quand il est disponible, sinon par
  score (titre normalisé, artiste, durée à ±3 s près). Toujours renvoyer un score de
  confiance et la liste des titres non trouvés : ne jamais faire semblant d'avoir
  tout trouvé.
- **Erreurs** : les erreurs d'API (quota, 401, 403, 429) sont typées et affichées
  clairement à l'utilisateur. Pas de `catch` vide.
- **Fichiers courts** : viser moins de 300 lignes par fichier ; découper au-delà.

## API des plateformes : contraintes connues

Ordre V1 : **Deezer (source) → Spotify (destination)**.

- **Deezer** : source V1, **lecture seule**. API publique sans clé (playlist, titres
  paginés, ISRC sur chaque titre, `GET /track/isrc:{ISRC}`). Écriture impossible (création
  d'app fermée aux particuliers). Quota ~50 requêtes / 5 s : prévoir un limiteur de débit.
  Les erreurs arrivent en HTTP 200 avec un objet `error` : toujours valider avec Zod.
- **Spotify** : destination V1. OAuth Authorization Code + PKCE, `POST /me/playlists`
  puis `POST /playlists/{id}/items` (**écriture vérifiée en Development Mode le
  27/11/2026** via l'ancienne page de test `/dev/spotify`), recherche par `isrc:` (`limit` ≤ 10, pas d'appels
  groupés `?ids=`). Scopes : `playlist-modify-private`, `playlist-read-private` et
  `user-read-private` (exigé par `market=from_token`, sinon 403 « Insufficient client
  scope »). Comme source : **seulement les playlists de l'utilisateur connecté**
  (ou collaboratives) ; un lien public quelconque renvoie une erreur typée « playlist non
  accessible », et les playlists créées par Spotify (éditoriales, Daily Mix…) répondent 404.
  Development Mode : 5 utilisateurs max. Ne pas supposer qu'un endpoint fonctionne : vérifier.
- **YouTube Music** : **source** via l'**API officielle YouTube Data v3** (les playlists YT Music
  sont des playlists YouTube), avec la clé développeur `YOUTUBE_API_KEY` envoyée en en-tête
  `X-goog-api-key` (facultative : sans elle, « non configuré »). Lecture vérifiée 11/11
  (artiste via la chaîne « Artiste - Topic », durée via `videos.list`) ; ni album ni ISRC,
  donc matching par score. Quota : 10 000 unités/jour pour toute l'appli (~2 unités pour
  50 titres en lecture, mais **100 par recherche**) : pas de destination YouTube pour
  l'instant. Mix (`RD…`) et titres likés (`LM`) illisibles. Ne plus utiliser youtubei.js.
- **SoundCloud** : **en pause** (enregistrer une app demande un abonnement Artist Pro).
  Ne pas scraper de `client_id`.
- Les résultats des spikes sont consignés dans `spikes/RESULTS.md` : s'y référer
  avant de coder un provider.

## Secrets

- Jamais de secret dans le code ni dans un commit. `.env.local` est ignoré par git ;
  `.env.example` liste les variables sans valeurs.
- **En session cloud**, `SPOTIFY_CLIENT_SECRET` n'existe pas : l'authentification
  Basic vers `accounts.spotify.com` est ajoutée par le proxy de l'environnement
  (secret réseau). Le code doit donc fonctionner dans les deux cas : si
  `SPOTIFY_CLIENT_SECRET` est défini, envoyer l'en-tête `Authorization` ; sinon,
  ne pas l'envoyer.

## Façon de travailler

- Une fonctionnalité = une branche = une PR. Petites PR, faciles à relire.
- Pour toute tâche non triviale, proposer un plan avant de coder.
- Écrire les tests en même temps que le code (au minimum pour `core/`).
- Messages de commit au format Conventional Commits (`feat:`, `fix:`, `refactor:`...).
- Si une consigne de ce fichier bloque ou semble mauvaise, le dire au lieu de la
  contourner.

## Git

- `main` est protégée : on n'y pousse jamais directement, tout passe par une PR.
- Noms de branches : `<type>/<description-courte>` en minuscules avec des tirets,
  avec les mêmes types que les commits.
  Exemples : `feat/conversion-spotify`, `fix/matching-featuring`, `docs/readme`.
  (Les branches créées par les sessions cloud commencent par `claude/` : c'est normal.)
- Commits : Conventional Commits, en français, à l'impératif présent,
  première ligne de 72 caractères maximum. Un commit = un changement cohérent.
- Avant d'ouvrir une PR : `pnpm lint && pnpm typecheck && pnpm test` passent.
- Titre de PR au format Conventional Commits ; description avec ce qui change,
  pourquoi, et comment tester.
- On fusionne les PR en « Squash and merge » pour garder un historique de `main` lisible.

## Interface

- Mobile d'abord : tout doit être utilisable sur un écran de téléphone.
- Thème clair et sombre.
- Accessibilité : contrastes suffisants, navigation clavier, libellés sur les boutons-icônes.
- Une conversion affiche sa progression et un récapitulatif clair
  (trouvés / incertains / introuvables), avec la possibilité de corriger un titre
  à la main avant de créer la playlist.

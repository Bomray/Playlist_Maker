# CLAUDE.md

Ce fichier est lu par Claude au début de chaque session. Garde-le court et à jour :
quand une décision change, change-la ici.

## Le projet

Application web (responsive, puis installable en PWA) pour manipuler des playlists
entre plateformes de streaming.

- **V1 (en cours)** : convertir une playlist d'une plateforme vers une autre en un clic,
  à partir de son lien. Plateformes visées : Spotify, YouTube Music, Deezer, SoundCloud.
  Pas de système de comptes pour l'instant.
- **Plus tard** : génération de playlists à partir d'une demande écrite (IA),
  statistiques d'écoute multi-plateformes, filtres personnalisés sauvegardables.
  Ne rien construire pour ces fonctionnalités tant que la V1 n'est pas terminée.

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
  27/11/2026** via `/dev/spotify`), recherche par `isrc:` (`limit` ≤ 10, pas d'appels
  groupés `?ids=`). Scopes : `playlist-modify-private`, `playlist-read-private` et
  `user-read-private` (exigé par `market=from_token`, sinon 403 « Insufficient client
  scope »). Comme source : **seulement les playlists de l'utilisateur connecté**
  (ou collaboratives) ; un lien public quelconque renvoie une erreur typée « playlist non
  accessible », et les playlists créées par Spotify (éditoriales, Daily Mix…) répondent 404.
  Development Mode : 5 utilisateurs max. Ne pas supposer qu'un endpoint fonctionne : vérifier.
- **YouTube Music** : 3ᵉ plateforme, après la V1 Deezer → Spotify. Pas d'API officielle :
  lecture fragile, recherche bloquée depuis une IP de datacenter, écriture via YouTube
  Data API v3 (quota serré). Isoler complètement dans `providers/youtube-music/`.
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

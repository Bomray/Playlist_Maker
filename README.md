# Playlist_Maker

Convertisseur de playlists entre plateformes de streaming (Deezer et YouTube Music →
Spotify) et stats d'écoute Spotify. En ligne : https://playlist-maker-bomray.vercel.app

Voir `CLAUDE.md` pour l'architecture, les conventions et l'avancement.

## Développement local

```bash
pnpm install
cp .env.example .env.local   # puis remplir les valeurs
pnpm dev                     # http://127.0.0.1:3000
```

En local, `DATABASE_URL=pglite:.dev-db` donne une base PostgreSQL locale (PGlite), sans
compte ni réseau : les tables sont créées au premier lancement. Pour travailler sur une
vraie base Neon, utiliser l'adresse d'une **branche de développement** Neon (jamais celle de
production) puis `pnpm db:migrate`.

Tests de bout en bout : `pnpm test:e2e` lance son propre serveur (port 3100, base PGlite
préremplie). Arrêter `pnpm dev` avant : Next.js n'accepte qu'un serveur de dev par dossier.

## Mise en ligne (Vercel)

L'appli est hébergée sur Vercel (offre gratuite, voir
`docs/decisions/0002-enregistrement-continu-des-ecoutes.md`). Chaque fusion sur `main`
met le site à jour automatiquement ; chaque PR obtient une adresse de prévisualisation.

### Première mise en ligne

1. Sur https://vercel.com/new, importer le dépôt GitHub `Playlist_Maker`
   (framework détecté : Next.js, laisser les réglages de build par défaut).
2. Avant de lancer le déploiement, ajouter les **variables d'environnement** :

   | Variable                       | Valeur                                                           |
   | ------------------------------ | ---------------------------------------------------------------- |
   | `ENABLE_EXPERIMENTAL_COREPACK` | `1` (pour que Vercel utilise pnpm 12, imposé par `package.json`) |
   | `SPOTIFY_CLIENT_ID`            | Client ID du dashboard Spotify                                   |
   | `SPOTIFY_CLIENT_SECRET`        | Client secret du dashboard Spotify                               |
   | `SPOTIFY_REDIRECT_URI`         | `https://<nom-du-projet>.vercel.app/callback`                    |
   | `SESSION_SECRET`               | une **nouvelle** valeur, différente de celle du `.env.local`     |
   | `YOUTUBE_API_KEY`              | clé YouTube Data v3 (facultative)                                |

   Générer `SESSION_SECRET` :
   `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`

3. Dans le dashboard Spotify (Settings → Redirect URIs), **ajouter** l'URI de production
   `https://<nom-du-projet>.vercel.app/callback`, en gardant celle du développement local.
4. Pour d'autres utilisateurs (5 au maximum en Development Mode) : les ajouter dans
   l'onglet « User Management » du dashboard Spotify.

Si l'adresse finale du projet diffère, mettre à jour `SPOTIFY_REDIRECT_URI` dans Vercel
(puis redéployer) et l'URI dans le dashboard Spotify.

### Base de données (Neon)

1. Dans le projet Vercel : **Storage** → **Create Database** → **Neon** → accepter les
   options par défaut (offre gratuite), relier la base au projet pour **Production** et
   **Preview**. Vercel ajoute `DATABASE_URL` (et d'autres variables `PG*`) au projet.
2. Ajouter `TOKEN_ENCRYPTION_KEY` dans les variables d'environnement.
3. Redéployer : le build de production applique les migrations (`db/migrations/*.sql`)
   avant `next build`. Les aperçus de PR ne migrent pas la base.

Changer `TOKEN_ENCRYPTION_KEY` rend les tokens enregistrés illisibles : chacun devra se
reconnecter à Spotify.

### Enregistrement automatique des écoutes (toutes les heures)

La tâche `.github/workflows/collect.yml` appelle `POST /api/cron/collect` toutes les heures
(minute 17). Configuration, une seule fois :

1. Générer un secret :
   `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`
2. Vercel → Settings → Environment Variables : ajouter `CRON_SECRET` (Production, Sensitive),
   puis redéployer.
3. GitHub → dépôt → Settings → Secrets and variables → Actions → **New repository secret** :
   `CRON_SECRET` avec **la même valeur**.
4. Tester : onglet **Actions** → « Collecte des écoutes » → **Run workflow**. Le journal
   affiche des compteurs (`users`, `fetched`, `inserted`, `errors`).

GitHub désactive les tâches planifiées d'un dépôt public après **60 jours sans activité** :
réactiver alors le workflow dans l'onglet Actions. Chaque utilisateur active l'enregistrement
lui-même sur la page `/stats`.

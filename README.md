# Playlist_Maker

Convertisseur de playlists entre plateformes de streaming (Deezer et YouTube Music →
Spotify) et stats d'écoute Spotify.

Voir `CLAUDE.md` pour l'architecture, les conventions et l'avancement.

## Développement local

```bash
pnpm install
cp .env.example .env.local   # puis remplir les valeurs
pnpm dev                     # http://127.0.0.1:3000
```

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

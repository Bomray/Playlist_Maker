# 0002 — Enregistrement continu des écoutes : Vercel, Neon et GitHub Actions

Date : 27 novembre 2026

## Contexte

Les stats voulues (temps d'écoute en minutes, heures et jours, nombre d'écoutes, tops) ont
besoin de l'historique écoute par écoute. Deux sources :

- **le passé** : l'export Spotify « Historique de streaming étendu », déjà lu dans le
  navigateur par la page `/stats` (étape 7a) ;
- **la suite** : `GET /me/player/recently-played`, qui ne garde que les **50 dernières
  écoutes** (vérifié au spike 2). Il faut l'interroger régulièrement, même quand
  l'utilisateur n'ouvre pas l'appli, et stocker le résultat.

Il faut donc un hébergement, une base de données et une tâche planifiée. Contraintes :
gratuit, et **aucun compte supplémentaire pour l'utilisateur final** (CLAUDE.md). Les
comptes ci-dessous sont créés une fois par le développeur. Échelle : 5 utilisateurs au
plus (Development Mode Spotify).

## Décision

| Pièce           | Choix                                                     | Rôle                                                       |
| --------------- | --------------------------------------------------------- | ---------------------------------------------------------- |
| Hébergement     | **Vercel**, offre gratuite                                | Héberge l'appli ; mise en ligne à chaque fusion sur `main` |
| Base de données | **Neon**, PostgreSQL gratuit                              | Utilisateurs, tokens Spotify chiffrés, morceaux, écoutes   |
| Tâche planifiée | **GitHub Actions**, workflow `schedule` toutes les heures | Appelle `POST /api/cron/collect`                           |

- **L'historique importé est stocké en base** (choix de l'utilisateur). Il est importé une
  fois et disponible sur tous les appareils, fusionné avec les écoutes enregistrées.
- **La base devient la source des tokens Spotify.** Le cookie ne garde plus qu'un
  identifiant de session (l'utilisateur), et les tokens sont en base, chiffrés en
  AES-256-GCM avec une clé dédiée `TOKEN_ENCRYPTION_KEY`, distincte de `SESSION_SECRET`.
  Cela remplace la décision 0001 pour les tokens. La raison : la tâche planifiée et le
  navigateur rafraîchissent le même token, et si Spotify fait tourner les refresh tokens,
  deux copies (cookie et base) finiraient par s'invalider l'une l'autre.
- **Enregistrement sur accord explicite** (« Enregistrer mes écoutes »), avec une action
  « Supprimer toutes mes données ».
- **Données minimales** : pour une écoute, l'utilisateur, le morceau, la date de fin et la
  durée écoutée. Jamais d'IP, de pays ni d'appareil (déjà ignorés à la lecture de l'export).

### Schéma (à affiner dans la PR concernée)

- `users` : identifiant Spotify, refresh token chiffré, scopes, `collecting` (accord), date et
  curseur de la dernière collecte.
- `tracks` : URI Spotify (ou artiste + titre sans URI), titre, artiste, album. Un morceau
  n'est stocké qu'une fois, partagé entre utilisateurs.
- `plays` : utilisateur, morceau, date de fin, durée écoutée, origine (`import` ou `api`).
  Clé unique pour ne jamais compter deux fois. **Mise à jour (PR d'import)** : la clé
  (utilisateur, morceau, date de fin) écartait à tort des écoutes hors ligne synchronisées
  ensemble (même date de fin). Clé retenue : (utilisateur, date de fin, morceau, durée écoutée,
  `offline_timestamp`). Sur un export réel de 290 129 lignes, elle n'en écarte que 44, dont 36
  strictement identiques (contre 221 avant).

Estimation : environ 50 octets par écoute avec index, soit environ 15 Mo pour 290 000
écoutes. Ça tient largement dans l'offre gratuite de Neon, même à 5 gros auditeurs.

### Collecte toutes les heures

1. GitHub Actions appelle `POST /api/cron/collect` avec `Authorization: Bearer <CRON_SECRET>`
   (secret du dépôt, jamais dans le code).
2. Pour chaque utilisateur qui a donné son accord : rafraîchit le token, appelle
   `recently-played?after=<curseur>`, insère les nouvelles écoutes, avance le curseur.
3. Une erreur sur un utilisateur (accès révoqué…) est enregistrée pour lui, sans bloquer
   les autres.

Une fois par heure suffit : avec environ 145 écoutes par jour (6 par heure en moyenne), le
tampon de 50 écoutes laisse plusieurs heures de marge si une exécution saute.

### Import de l'export vers la base

Le navigateur lit déjà l'archive (Web Worker, étape 7a). Il envoie ensuite les écoutes déjà
réduites aux champs utiles, **par lots** (par exemple 5 000), car Vercel limite la taille
d'une requête à environ 4,5 Mo. L'archive brute (220 Mo) n'est jamais envoyée.

## Pourquoi

- **Vercel** : fait pour Next.js, gratuit pour un usage non commercial. Ses tâches planifiées
  gratuites ne tournent qu'**une fois par jour**, d'où GitHub Actions pour l'horaire.
- **Neon plutôt que Supabase** : Neon met la base en veille et la réveille seul à la
  connexion suivante. La base gratuite de Supabase se met en **pause après 7 jours
  d'inactivité** et se relance à la main. On n'a pas besoin des outils en plus de Supabase
  (authentification, stockage de fichiers).
- **GitHub Actions plutôt qu'un service externe** : le dépôt est public, donc les minutes
  sont illimitées et gratuites, sans compte de plus. Tout est versionné dans le dépôt.

## Conséquences et risques

- **GitHub désactive les tâches planifiées après 60 jours sans activité** sur un dépôt
  public. Si le projet dort, il faut réactiver le workflow d'un clic (onglet Actions). Les
  lancements peuvent aussi avoir quelques minutes de retard, ce qui est sans conséquence ici.
- **`recently-played` ne donne pas la durée réellement écoutée**, seulement la durée du
  morceau. Pour les écoutes enregistrées, temps d'écoute = durée du morceau. Spotify n'y
  inscrit a priori que les lectures d'au moins 30 s (à vérifier). Les stats importées
  (`ms_played` réel) et enregistrées seront donc légèrement différentes : à indiquer dans
  l'interface.
- **Recouvrement entre l'export et la collecte** : un export demandé après le début de la
  collecte contient des écoutes déjà enregistrées. Le dédoublonnage par (utilisateur,
  morceau, date de fin) suppose que `played_at` de l'API corresponde à `ts` de l'export ;
  **à vérifier par un test réel avant de coder la fusion** (sinon, tolérance de quelques
  secondes).
- **Données personnelles sur un serveur** : historique d'écoute et tokens. Atténuation :
  accord explicite, suppression complète possible, tokens chiffrés, données minimales.
- **Mise en ligne** : il faudra ajouter l'adresse Vercel (`https://…/callback`) dans le
  dashboard Spotify, et les variables d'environnement dans Vercel.
- Les chiffres des offres gratuites (stockage Neon de 0,5 à 1 Go selon les sources,
  limites Vercel) sont à confirmer sur leurs pages officielles au moment de créer les
  comptes.

## Découpage en PR

1. **Mise en ligne sur Vercel** (sans base) : variables d'environnement, URI de redirection
   Spotify, test depuis le téléphone.
2. **Base Neon et session en base** : migrations SQL, table `users`, tokens chiffrés en base,
   cookie réduit à l'identifiant de session.
3. **Import de l'export vers la base** et stats calculées depuis la base (réutilise
   `core/stats`).
4. **Collecte toutes les heures** : route `POST /api/cron/collect`, workflow GitHub Actions,
   accord et suppression des données dans l'interface.

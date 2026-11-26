# 0001 — Session Spotify dans un cookie chiffré

Date : 27 novembre 2026

## Contexte

La connexion Spotify (OAuth Authorization Code + PKCE) produit un access token
(1 h) et un refresh token. Il faut les garder entre deux requêtes, côté serveur,
sans les exposer au JavaScript du navigateur. La V1 n'a ni comptes ni base de données.

## Décision

Les tokens sont stockés dans un cookie `httpOnly`, `SameSite=Lax` (`Secure` en
production), **chiffré en AES-256-GCM** avec `node:crypto` et la clé `SESSION_SECRET`
(`src/lib/crypto-box.ts`, `src/lib/session.ts`). Le `code_verifier` et le `state`
PKCE passent par un second cookie chiffré, valable 10 minutes et supprimé après usage.

## Pourquoi

- Pas d'infrastructure : pas de base ni de Redis à héberger pour 5 utilisateurs.
- `httpOnly` empêche le JavaScript de lire le cookie ; GCM empêche de le lire ou de
  le modifier même en le copiant (contenu chiffré et authentifié).
- Pas de nouvelle dépendance (iron-session ferait la même chose) : ~40 lignes testées.

## Conséquences

- Changer `SESSION_SECRET` déconnecte tout le monde (les cookies deviennent illisibles).
- Pas de révocation côté serveur : la déconnexion supprime le cookie du navigateur.
- Le jour où il y aura des comptes, on passera à une session en base.

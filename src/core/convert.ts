// Orchestration d'une conversion (à venir) :
// 1. lire la playlist source via son MusicProvider ;
// 2. chercher chaque titre sur la destination (ISRC d'abord, puis score) ;
// 3. renvoyer trouvés / incertains / introuvables avec un score de confiance ;
// 4. créer la playlist après validation de l'utilisateur.
// Les providers sont injectés : ce module ne connaît que l'interface MusicProvider.
export {};

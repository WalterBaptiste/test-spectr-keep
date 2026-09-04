# Guess the Spectr — Keep Hush

[Jouer à Guess the Spectr](https://spectr-guess-lineup.blankaa.chatgpt.site)

Jeu mobile du collectif Spectr avec 2 × 2 places à gagner pour la soirée Keep Hush.

## GitHub Pages

Les fichiers `index.html` et `assets/` sont déjà placés à la racine pour GitHub Pages.

Dans le dépôt : **Settings → Pages → Deploy from a branch → main → /(root)**.

Le formulaire est déjà connecté au Google Apps Script de Spectr et envoie les participations vers l'onglet `Scores` du Google Sheet.

## Modifier les lettres visibles

Dans `index.html`, rechercher `const ARTISTS`. Dans un `mask`, une lettre est visible et `_` représente une lettre cachée.

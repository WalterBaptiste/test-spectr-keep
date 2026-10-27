# Spectr — La quête du Karmen

Jeu point-and-click mobile dans lequel le joueur avance pendant une soirée au Karmen Camina : extérieur, entrée, physio, bar, escalier, exposition ou terrasse, puis dancefloor.

## Publication sur GitHub Pages

1. Ouvrir le dépôt GitHub destiné au jeu.
2. Cliquer sur **Add file**, puis **Upload files**.
3. Envoyer directement à la racine : `index.html`, `styles.css`, `game.js` et le dossier `assets`.
4. Cliquer sur **Commit changes**.
5. Ouvrir **Settings > Pages**.
6. Choisir **Deploy from a branch**, la branche `main`, puis `/(root)`.

L'adresse sera généralement :

`https://PSEUDO.github.io/NOM-DU-DEPOT/`

## Fichiers à modifier

- `index.html` : écrans, textes et zones cliquables ;
- `styles.css` : couleurs, tailles et mise en page ;
- `game.js` : histoire, choix, scores, profils, musique et connexion Google Sheets ;
- `assets/` : photos du Karmen et personnages animés.

Les zones cliquables sont réglées dans `index.html` avec les valeurs `--x` et `--y` exprimées en pourcentage de la photo.

## Google Sheets

L'adresse Google Apps Script se trouve au début de `game.js`, dans `CONFIG.endpoint`. La version fournie contient déjà l'adresse configurée précédemment.

## Musique

Pour ajouter un morceau :

1. placer le MP3 dans `assets`, par exemple `spectr-theme.mp3` ;
2. ouvrir `game.js` ;
3. renseigner `CONFIG.music.src`, `title` et `artist`.

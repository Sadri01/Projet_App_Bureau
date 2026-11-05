# Mon Planning

Application de bureau pour Windows 11 (emploi du temps, to-do list, rappels au premier plan, widgets sur le bureau), avec sa version téléphone pour Android.

## Fonctionnalités

**Emploi du temps**
- Vue semaine type agenda. Pour créer une activité, clique sur un créneau ou glisse sur plusieurs heures.
- Pour déplacer une activité, glisse-la. Pour changer sa durée, tire son bord du bas.
- Chaque activité a une couleur, des horaires, des notes et une répétition : une fois, tous les jours, ou certains jours de la semaine, avec une date de fin.
- Tu peux supprimer une seule séance d'une activité répétée.
- Pour planifier une tâche de la to-do list, glisse-la dans l'agenda.
- Les tâches qui ont une échéance apparaissent en haut du jour concerné.

**Rappels**
- Un pop-up s'affiche au premier plan, avec un son, au début de chaque activité.
- Un rappel peut aussi arriver avant le début : 5, 10, 15, 30 ou 60 min, réglable par activité.
- Boutons du pop-up : **J'y vais** (la séance compte comme faite), **Dans 5 min** et **Passer**.
- Les échéances des tâches déclenchent aussi un rappel.
- Mode **Ne pas déranger** : 30 min, 1 h, 2 h ou jusqu'au lendemain.
- 5 sons au choix, ou ton propre fichier MP3, WAV ou OGG.

**To-do list**
- Statuts : Urgent, Normal, Terminée, Abandonnée. Les tâches terminées restent dans l'historique.
- Catégories personnalisées avec couleur (Travail, Sport, Japonais…).
- Sous-tâches, échéance, notes et recherche.

**Récapitulatif**
- Camembert de la répartition des activités par jour, semaine ou mois.
- Temps prévu et temps réalisé, avec la progression par activité.
- Camembert des tâches terminées par catégorie.

**Brainstorming (tableau blanc façon Miro)**
- Feuille infinie : molette pour zoomer, <kbd>Espace</kbd> + glisser (ou clic droit) pour se déplacer, bouton « Tout voir ».
- Crayon et surligneur avec couleur et taille réglables. Un cercle montre la taille du pinceau.
- Gomme de taille réglable, qui efface seulement la partie du trait touchée.
- Formes : rectangle, cercle, triangle, losange, avec ou sans remplissage. Traits et flèches.
- Texte libre et post-it de couleur. Double-clic pour modifier un texte.
- Sélection d'un ou plusieurs éléments (encadrer, ou <kbd>Maj</kbd>+clic). On peut les déplacer, les redimensionner, les dupliquer, les mettre au premier plan ou les supprimer.
- Annuler et rétablir (<kbd>Ctrl</kbd>+<kbd>Z</kbd> / <kbd>Ctrl</kbd>+<kbd>Y</kbd>).
- Plusieurs feuilles, qu'on peut renommer et supprimer.
- **Capture** : enregistre toute la feuille en image PNG. **Copier l'image** la met dans le presse-papiers, prête à coller ailleurs.

| Touche | Outil |
|---|---|
| <kbd>V</kbd> | Sélection |
| <kbd>H</kbd> | Main (se déplacer) |
| <kbd>P</kbd> | Crayon |
| <kbd>M</kbd> | Surligneur |
| <kbd>E</kbd> | Gomme |
| <kbd>R</kbd> | Rectangle |
| <kbd>O</kbd> | Cercle |
| <kbd>G</kbd> | Triangle |
| <kbd>D</kbd> | Losange |
| <kbd>L</kbd> | Trait |
| <kbd>A</kbd> | Flèche |
| <kbd>T</kbd> | Texte |
| <kbd>N</kbd> | Post-it |
| <kbd>[</kbd> / <kbd>]</kbd> | Réduire / agrandir la taille |

**Widgets de bureau**
- To-do list et/ou emploi du temps du jour, ou aucun des deux.
- Ils restent sur le bureau, derrière tes fenêtres.
- <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>W</kbd> les fait passer au premier plan. Ils repassent derrière dès que tu cliques ailleurs.
- On peut les déplacer, les redimensionner et régler leur opacité.

**Et aussi**
- 3 thèmes : Minimaliste coloré, Sombre, Survie (post-apocalyptique).
- Option pour lancer l'application au démarrage de Windows.
- Une icône près de l'horloge : fermer la fenêtre n'arrête pas les rappels.
- Minuteur Pomodoro. Il peut se lancer quand tu cliques sur « J'y vais ».
- Import d'agendas externes : Google Agenda ou Outlook par lien `.ics`, ou un fichier `.ics`.
- Sauvegarde automatique chaque jour, plus un export et une restauration manuels.

## Appli téléphone (Android)

L'appli téléphone a les mêmes sections que sur PC : emploi du temps (3 jours visibles), to-do list, récapitulatif, brainstorming (dessin au doigt, pincer pour zoomer), Pomodoro et réglages.

**L'installer :**
1. Ouvre https://sadri01.github.io/Projet_App_Bureau/ dans Chrome sur ton téléphone.
2. Menu ⋮ → **Installer l'application** (ou **Ajouter à l'écran d'accueil**).
3. Elle s'ouvre ensuite comme une vraie appli, même sans Internet.

**Ce qui est différent du PC :**
- Les rappels ne fonctionnent que si l'appli est ouverte, ou en arrière-plan depuis peu. Android met les applis web en veille.
- Pas de widgets, de raccourcis clavier ni de lancement au démarrage.
- Les agendas Google ou Outlook se gèrent sur le PC ; leurs événements arrivent sur le téléphone avec la synchronisation.

Quand une nouvelle version est publiée, l'appli propose de **Recharger** pour l'installer.

## Synchronisation PC ↔ téléphone

Il n'y a ni compte ni serveur : les données passent par un **code** que tu copies d'un appareil à l'autre.

1. Sur un appareil, va dans **Réglages → Synchronisation** et clique sur **Copier mon code**. Sur téléphone, tu peux aussi utiliser **Partager**.
2. Envoie-toi le code, par exemple par WhatsApp ou par mail.
3. Sur l'autre appareil, colle-le dans la même section puis clique sur **Fusionner**.

Rien n'est écrasé. Pour chaque activité, tâche, catégorie ou feuille, c'est la modification la plus récente qui gagne. Une suppression faite sur un appareil est aussi appliquée sur l'autre. Les réglages (thème, sons, widgets…) restent propres à chaque appareil.

Fais l'opération dans les deux sens pour que les deux appareils soient identiques.

Si le code est trop long pour ta messagerie (beaucoup de dessins), deux solutions :
- décoche « Inclure les feuilles de brainstorming » ;
- ou utilise **En fichier** puis **Ouvrir un fichier**.

Sur PC, une copie de sécurité est faite avant chaque fusion, dans le dossier des sauvegardes.

## Raccourcis clavier

Tu peux les modifier dans **Réglages → Raccourcis clavier**.

| Raccourci | Action |
|---|---|
| <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>T</kbd> | Ajouter une tâche depuis n'importe où |
| <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>W</kbd> | Passer les widgets au premier plan |
| <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>P</kbd> | Ouvrir la fenêtre principale |
| <kbd>←</kbd> / <kbd>→</kbd> | Semaine précédente / suivante (dans l'emploi du temps) |

## Saisie rapide d'une tâche

Dans la barre d'ajout, le widget ou la fenêtre <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>T</kbd>, tu peux écrire par exemple :

```
Réviser les kanji !urgent #japonais @demain 18h
```

- `!urgent` ou `!` met la tâche en urgent.
- `#nom` ajoute une catégorie existante. Les accents et majuscules ne comptent pas.
- `@demain`, `@lundi`, `@12/11`, `@18h` ou `@demain 18h30` fixent l'échéance.

## Importer Google Agenda

1. Ouvre Google Agenda sur ordinateur, puis **Paramètres** et l'agenda voulu.
2. Copie l'**Adresse secrète au format iCal**.
3. Dans Mon Planning, va dans **Réglages → Agendas externes**, colle le lien et clique sur **Ajouter**.

L'agenda est actualisé toutes les 30 minutes. Il est en lecture seule dans Mon Planning.

## Installer et tester

### Option 1 : installer l'appli (recommandé)

1. Ouvre la page [Releases](https://github.com/Sadri01/Projet_App_Bureau/releases/latest) du dépôt.
2. Télécharge `Mon-Planning-Setup-x.y.z.exe` et lance-le.
3. Windows SmartScreen peut afficher « Windows a protégé votre ordinateur », car l'application n'est pas signée. Clique sur **Informations complémentaires**, puis **Exécuter quand même**.

**Mises à jour automatiques.** L'appli vérifie s'il existe une nouvelle version au démarrage, puis toutes les 4 heures. Si oui, elle la télécharge en arrière-plan. Un pop-up propose alors de redémarrer tout de suite. Sinon, la mise à jour s'installe quand tu quittes l'appli. Tu peux aussi lancer une recherche à la main dans **Réglages → Mises à jour**.

### Option 2 : lancer depuis le code

Il faut [Node.js](https://nodejs.org) (version 22 ou plus).

```bash
npm install
npm start
```

- `npm test` lance les tests automatiques.
- `npm run dist` construit l'installeur Windows dans `dist/`.

### Publier une nouvelle version

1. Augmente le numéro `version` dans `package.json` (par exemple 0.2.0 → 0.2.1).
2. Envoie le code sur GitHub.
3. Le workflow **Installeur Windows et appli téléphone** construit l'installeur. Comme ce numéro n'a jamais été publié, il crée une Release, et les applis installées se mettent à jour toutes seules.

Sans changement de numéro, l'installeur est seulement construit (onglet Actions), sans être distribué.

L'appli téléphone, elle, est republiée à chaque envoi de code, sur la branche `gh-pages`. Pour qu'elle soit en ligne, active GitHub Pages une seule fois : **Settings → Pages → Build and deployment → Source : Deploy from a branch → `gh-pages` / `(root)` → Save**.

Pour essayer l'appli téléphone sur ton ordinateur :

```bash
npm run build:web
cd dist-web && python3 -m http.server 8000
```

Puis ouvre http://localhost:8000.

Le lancement au démarrage de Windows ne fonctionne qu'avec la version installée.

## Où sont mes données ?

Tout reste sur ton ordinateur, dans `%APPDATA%\Mon Planning\` :
- `donnees.json` contient tes données ;
- `sauvegardes\` contient les copies quotidiennes (les 10 dernières).

## Organisation du code

```
src/
  main/          processus principal (Electron)
    main.js        fenêtres, icône près de l'horloge, raccourcis, démarrage auto
    scheduler.js   moteur de rappels
    store.js       enregistrement des données et sauvegardes
    pomodoro.js    minuteur
    updater.js     mises à jour automatiques
    ics.js         import d'agendas
  preload.js     pont sécurisé entre l'interface et le processus principal
  shared/
    schedule.js    calculs de dates et de récurrence (utilisés partout)
    data.js        modèle de données (dates de modification, suppressions)
    sync.js        code de synchronisation et fusion entre appareils
  web/           appli téléphone
    api-web.js     remplace le processus principal dans le navigateur
    sw.js          fonctionnement hors ligne et mises à jour
  renderer/      interface
    index.html     fenêtre principale
    popup.html     pop-up de rappel
    widget.html    widgets de bureau
    quickadd.html  ajout rapide de tâche
    css/           thèmes et styles
    js/            une vue par fichier (agenda, todo, stats, brainstorm, pomodoro, réglages)
test/            tests automatiques
```

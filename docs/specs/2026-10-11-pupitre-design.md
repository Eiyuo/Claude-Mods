# Mod « pupitre » pour Claude Code — conception

**Date :** 11/10/2026.
**Statut :** conception validée à l'oral, partie par partie. Ce document attend la relecture de l'utilisateur.

## 1. Objectif

Recréer, dans un seul mod Claude Code, cinq fonctions vues dans une vidéo, sans en avoir le code source :
- voir d'un coup d'œil ce qui reste : contexte, limites 5 h et 7 jours ;
- voir où en est Claude, ses sous-agents et les autres discussions ouvertes ;
- ne plus avoir à demander « c'est quoi la suite ? » ;
- passer le relais à une conversation neuve sans rien perdre ;
- transformer une demande vague en demande précise, en un clic.

**Pour qui.** L'utilisateur n'est pas développeur. Il travaille dans l'onglet Code de l'application de bureau Claude, au bureau et chez lui.

**Ce qui compte pour lui.** Un rendu « premium », sobre et lisible. Il juge sur maquette.

## 2. Décisions de l'utilisateur (11/10/2026)

| Sujet | Décision |
|---|---|
| Découpage | **Un seul mod, « pupitre »**, qui regroupe les 5 fonctions |
| Activation | **/pupitre** allume les 5 fonctions d'un coup. Si tout est déjà allumé, il éteint tout. **/jauge, /fil, /relais, /plume** allument ou éteignent leur seule fonction. **/cap** agit quand on le tape. Le choix est gardé d'une session à l'autre, et un message confirme chaque changement |
| Rangement | Dépôt GitHub public `Eiyuo/Claude-Mods`, à part des projets de travail. Installé une fois sur chaque PC, il vaut pour tous les projets |
| /fil, ce qui est mesuré | Tâches finies sur tâches prévues, une ligne pour Claude et une par sous-agent (option 3) |
| /fil, autres fenêtres | Une ligne fine par autre discussion qui travaille (option 1) |
| /fil, style | Celui du curseur d'effort « Ultracode » de l'application : piste claire, pixels colorés, curseur. Dans la version « Après » : trame ordonnée, pixels nets et plats, bande de lumière, apparition des pixels (rendu aligné le 11/10 sur la maquette des 7 idées d'animation) |
| /fil, couleurs | Violet de 0 à 33 %, bleu de 33 à 66 %, turquoise de 66 à 99 %, **vert quand c'est terminé**. Remplacé le 12/10/2026 (1.0.5) par « Spectre », choisi sur prototype : six étapes, une par sixième (violet, indigo, bleu, cyan, turquoise, vert clair), puis vert ; la piste prend une teinte légère de l'étape (voir §7) |
| /fil, curseur | Il prend la couleur foncée de la barre et contient **un mot** décrivant l'étape en cours, en blanc |
| /fil, sous-agents | Même barre que Claude |
| /fil, son | Carillon doux de 2 notes à la fin d'une réponse, **seulement si elle a pris plus de 30 s** |
| /jauge, couleurs | Vert sous 50 % (large), jaune de 50 à 75 % (à surveiller), orange de 75 à 90 % (ça presse), rouge au-delà (critique). Partie remplie pleine, sans trous |
| /cap | Seulement quand on tape /cap |
| /relais | `relais.md` à la racine du projet ouvert, **jamais enregistré dans git** (exclusion locale ; changé le 11/10/2026 : le commit l'avait rendu public) |
| /plume | **Remplace** le texte de la zone de saisie. Un bouton « Revenir à mon texte » reste disponible 30 s |

Les maquettes validées ont été montrées dans la conversation. Elles ne sont pas conservées : ce document les décrit.

## 3. Ce que permet Claude Code (vérifié dans les types de la version 2.1.295)

- **La bande au-dessus de la zone de texte** est un `ui.render` sur `{ component: 'AbovePrompt' }`. Elle n'existe que sur les surfaces `terminal` et `desktop`.
- **Le dessin.** Sur `desktop`, un élément `Svg` affiche un dessin vectoriel de 131 072 caractères au plus. Avec `isInteractive: true`, il est rendu dans un cadre isolé où les animations CSS et SMIL fonctionnent, mais pas les scripts. Le `terminal` n'a pas d'élément `Svg` : il reçoit une version en caractères (voir §11).
- **Les chiffres.** `$.session.usage()` et l'événement `session.measure` donnent :
  - `context` : remplissage et taille de la fenêtre ;
  - `rateLimits` : `five_hour` et `seven_day`, avec `percentUsed` et `resetsAt`, mais seulement avec un abonnement ;
  - `cost`.
- **Le suivi du travail.**
  - Les événements `turn.start`, `turn.step` et `turn.complete` encadrent chaque réponse.
  - `tool.call` signale chaque outil appelé, avec `agentId` pour un sous-agent (absent pour Claude).
  - `agent.spawn` signale le lancement d'un sous-agent.
  - Les outils `TaskCreate`, `TaskUpdate` et `TodoWrite` portent les listes de tâches.
- **La zone de saisie.** `$.prompt.read()` lit le brouillon, `$.prompt.fill({ text, mode })` le remplace. `$.prompt.submit()` envoie une demande ; le moteur refuse un envoi fait depuis un `command.run`, et retire le `context` joint à la demande d'un mod. Le mod envoie donc juste après la commande, avec la consigne entière dans le texte : sur l'application, ce qu'un `prompt.compose` ajoute au prompt système n'arrive pas à Claude (vu à l'essai du relais).
- **Les commandes.**
  - `$.command.register` déclare une commande, et un hook `command.run` y répond.
  - `$.command.run({ command: 'clear' })` lance `/clear`. Après un `/clear`, la conversation neuve repart d'un état vide et `session.start` ne revient pas (vérifié avec une sonde) : le tic d'une seconde remet réglages, mesures et barres.
  - `$.command.list()`, `$.tool.list()` et `$.agent.list()` donnent les skills, les commandes, les outils (connecteurs compris) et les sous-agents.
- **Le reste.** `$.model.complete({ model, system, prompt })` appelle un modèle. `$.store` garde des valeurs d'une session à l'autre. `$.fs` lit et écrit des fichiers, `$.clock` fournit les minuteries et `$.audio.play` joue un son du mod. `$.ui.toast` affiche un message.

## 4. Organisation des fichiers

```
Claude-Mods/
├── .claude-plugin/
│   └── marketplace.json          ← fait du dépôt une « place de marché » : installation en une ligne
├── pupitre/
│   ├── .claude-plugin/plugin.json   ← nom, version, description, "types"
│   ├── types/index.d.ts          ← contrat des valeurs $.state du mod
│   ├── hooks/
│   │   ├── hooks.json            ← { "modules": ["./register.tsx"] }
│   │   ├── register.tsx          ← branche les événements et les commandes, et dessine la bande
│   │   ├── etat.ts               ← réglages (store), état de session (state), fichier commun
│   │   ├── pixels.ts             ← fonctions pures : SVG d'une barre /fil et d'une jauge
│   │   ├── jauge.ts              ← lecture et mise en forme des chiffres (pourcentages, comptes à rebours)
│   │   ├── fil.ts                ← suivi des tâches, étapes, sous-agents ; estimation sans liste
│   │   ├── cap.ts                ← la demande de /cap
│   │   ├── relais.ts             ← enchaînement de /relais
│   │   ├── plume.ts              ← amélioration du brouillon
│   │   └── *.test.ts             ← tests (claude plugin test)
│   └── assets/carillon.wav       ← son de fin, fabriqué par outils/carillon.py
├── outils/carillon.py            ← fabrique le carillon (Python, bibliothèque standard seulement)
├── docs/specs/                   ← ce document
└── README.md                     ← installation, commandes
```

Ce découpage n'est qu'un point de départ : le plan le précisera. Chaque fichier a un seul rôle. Les calculs (pixels, comptes à rebours, progression, mots d'étape) sont des fonctions pures, testées sans l'application.

## 5. Commandes et réglages

| Commande | Effet |
|---|---|
| `/pupitre` | Allume les 5 fonctions. Si toutes sont déjà allumées, les éteint toutes |
| `/jauge` | Allume ou éteint la jauge |
| `/fil` | Allume ou éteint le suivi /fil |
| `/relais` | Allume ou éteint le bouton « Passer le relais » |
| `/plume` | Allume ou éteint le bouton « Améliorer le prompt » |
| `/cap` | Pose les questions de cap tout de suite (rien à allumer) |

**Réglages.**
- Ils sont rangés dans `$.store`, sous la clé `reglages = { jauge, fil, relais, plume, cap }` (booléens). Tant que rien n'est enregistré (première installation), tout est allumé, sans taper `/pupitre` (1.0.1 : avant, une installation neuve n'affichait rien). Un choix enregistré, même « tout éteint », est respecté. Chaque installation a ses propres réglages : la copie de développement et le mod installé ne les partagent pas.
- Le réglage des animations est rangé à part, sous la clé `animations` : `completes`, `reduites` ou `coupees` ; `completes` tant que rien n'est enregistré, ou si la valeur est illisible (1.0.4).
- `/pupitre` met aussi `cap` à vrai : il n'a pas d'élément visible, mais il sert à `/pupitre` pour savoir si « tout est allumé ».
- Chaque changement affiche un message, par exemple « Pupitre : fil éteint ».
- `/relais` et `/plume` allumés sans `/jauge` : la jauge s'affiche quand même, réduite à leurs boutons, qui doivent rester accessibles.

## 6. La bande au-dessus de la zone de texte

- **Ordre.** De haut en bas : les autres discussions, /fil, la jauge, la ligne des boutons, puis la ligne des réglages (si dépliée, juste sous « Réglages ») (demandes du 11/10/2026 ; les boutons passent sous la jauge à la demande de l'utilisateur).
- **Jauge sur une ligne, boutons sur la ligne du dessous.** « Contexte ▰▰▱ 86 % · Limite 5 h ▰▱▱ 14 % ↻ 2 h 12 · Limite 7 jours ▰▰▱ 31 % ↻ 5 j 5 h », réparties sur toute la largeur ; les boutons (relais, plume, Réglages) ont leur propre ligne, calée à droite, pour ne pas tasser les textes de la jauge. Depuis 1.0.7, sur le bureau, cette ligne est au pied de la zone de texte (le site `SessionMode`, que le bureau dessine en pastilles sur une ligne), demande du 12/10/2026 : le bureau reconstruit la bande en entier à chaque redessin (lu dans son code), et à part, sans lire les barres ni la jauge (valeur `pied`), les boutons ne sont plus refaits par elles. Au terminal, ils restent dans la bande. Les barres prennent la place qui reste (20 colonnes au plus). Quand la place manque, dans l'ordre : les comptes à rebours « ↻ » quittent la ligne (barres sous 6 colonnes), puis les noms raccourcissent (« 5 h », « 7 jours »), puis les barres descendent à 4 colonnes. Chaque texte est en `wrap="truncate"` : jamais de retour à la ligne, au pire « … ». Sur le bureau, une colonne fait 8 px et un caractère environ 7,2 px : `PAR_CAR_BUREAU` = 0,95 (mesuré sur capture, avec marge). Les barres sont des images (`Svg` sans `isInteractive`) : un cadre interactif se recharge à chaque changement et fait clignoter la barre ; une image garde l'ancienne version jusqu'à ce que la nouvelle soit prête. Pas d'info-bulle, donc.
- **Réglages (proposition A, retenue le 11/10/2026).** Un bouton « Réglages » au bout de la ligne des boutons déplie, juste en dessous, la ligne « Pupitre : ✓ Jauge · ✓ Fil · ✓ Relais · ✓ Plume · Tout éteindre (ou Tout allumer) · Replier ». Un clic bascule la fonction sans message ; si tout s'éteint, la ligne se replie, la bande disparaît et un message rappelle `/pupitre`. La ligne des boutons reste affichée tant qu'une fonction est allumée, pour que « Réglages » reste accessible. État déplié : `$.state` `reglagesOuverts`. Toujours en dernier, là où les barres sont des images (pas au terminal), la ligne « Animations : ✓ Complètes · ○ Réduites · ○ Coupées » (1.0.4, demande du 12/10/2026 pour les PC peu puissants ; état : `$.state` `animations`, voir §7).
- **Taille des barres.** Chaque `Svg` reçoit `width` et `height` : sans eux, le bureau donne 150 px de haut au cadre interactif.
- **Affichage.** Rien ne s'affiche quand tout est éteint, ou quand /fil n'a rien à montrer et que la jauge est éteinte.
- **Pas de redessin à vide.** La bande n'est redessinée que quand une valeur change : nouvelle mesure, tâche, étape, sous-agent, autre session, ou chaque seconde pour le chrono quand /fil est actif. La bande de lumière et les étincelles tournent seules dans le SVG. Une image qui n'a pas changé garde exactement le même texte d'un dessin à l'autre, sans être recalculée (1.0.3, pour les PC peu puissants) : le chrono qui redessine la bande chaque seconde ne fait plus recharger les images au bureau (vérifié sur le bureau le 12/10/2026 : à texte identique, l'image n'est pas rechargée et ses animations continuent sans à-coups). Une image qui change est rechargée : elle porte donc l'heure de son dessin (`--t`, pour les boucles) et le temps écoulé depuis le dernier changement (`--u`, pour les effets joués une fois). Ainsi, ses animations reprennent où elles en étaient, sans revenir en arrière.
- **Survey.** Quand `hasSurvey` est vrai, la bande cède la place.
- **Hauteur.** Si `maxRows` est trop petit (moins de 3), la jauge ne garde que ses boutons ; sous 8, /fil ne montre plus que la ligne de Claude.

## 7. Style des barres (commun à /fil et /jauge)

**Piste.**
- Fond clair, 0,5 px de contour. Pour /fil, depuis 1.0.5 (« barre entière », choisi sur prototype) : en cours, la piste prend une teinte légère de l'étape (sa nuance la plus claire à 20 %) et un contour de 1 px à sa couleur ; finie, elle redevient neutre.
- Coins arrondis : 7 px pour /fil (hauteur 22 px), 4 px pour la jauge (hauteur 10 px).

**Pixels.** Des carrés de 3 px pour /fil et de 2 px pour la jauge, sans espace entre eux : la partie remplie est pleine.

**Palettes** (4 nuances, de la plus claire à la plus foncée) :

| Palette | Nuances |
|---|---|
| Violet | #B2A6EE · #9687E4 · #7C6CDC · #6452D0 |
| Indigo (1.0.5) | #A3ADF0 · #8590E6 · #6875D8 · #4F5BC4 |
| Bleu | #84A8EC · #6490E6 · #4678DC · #2C60C8 |
| Cyan (1.0.5) | #7FD0E8 · #5BBCDB · #3AA6CA · #2489B0 |
| Turquoise | #5CC4BC · #38B2AA · #1E9C96 · #10827C |
| Vert clair (1.0.5) | #A9D67E · #8CC45C · #70AF42 · #579330 |
| Vert | #7CC280 · #58B060 · #3C9C48 · #288037 |
| Orange (jauge) | #F5AA5F · #EE9646 · #E8862A · #D6761E |
| Rouge (jauge) | #E66E6E · #DE5A5A · #D64545 · #C43737 |

**Disposition, version « Après ».**
- **Dégradé en trame.** Des 4 nuances entières, de la plus claire à la plus foncée en allant vers le bord avant, par une trame ordonnée (matrice de Bayer 4 × 4) qui choisit entre deux nuances voisines. Quand c'est terminé, le dégradé est uniforme.
- **Pixels nets et plats.** Pas de relief, pixels opaques, bords francs (`shape-rendering="crispEdges"`) : pas de flou ni de trait entre les pixels quand Windows agrandit l'affichage.
- **Bord avant.** Les 10 derniers pixels sont éclaircis, jusqu'à +22 %.
- **Étiquette discrète.** 12 px de haut, texte de 10 px, fond à 80 % d'opacité : les pixels se devinent dessous.

**Animation** (CSS dans le SVG, seulement `opacity`, `transform` et `fill`) :

| Effet | Détail |
|---|---|
| Étincelles | Environ 2 % des pixels, au hasard : un éclat blanc de 400 ms, toutes les 1,6 s |
| Bande de lumière | 15 colonnes blanches sur toute la hauteur, 40 % au centre et moins sur les bords, qui balaient la partie remplie colonne par colonne (une toutes les 18 ms), puis une pause : cycle de 2,6 s au moins |
| Apparition | Quand la barre avance, les nouvelles colonnes apparaissent pixel par pixel (décalage de 0 à 220 ms), avec un éclat qui s'éteint en 260 ms |
| Changement de couleur | Vague : l'ancienne couleur s'efface en 60 tranches de gauche à droite, 15 ms d'écart (0,9 s sur toute la barre), comme à la fin |
| Tête de lecture (/fil) | Pendant le travail, les pixels des 2 dernières colonnes clignotent (100 % → 20 %, 900 ms, décalés par rangée) et 4 pixels s'en détachent vers la droite sur 22 px (1,3 s) |
| En attente (/fil) | Rien de changé depuis 20 s (outil, étape, %) : la barre pâlit et respire lentement (3,4 s), sans reflet, étincelles ni tête. Ne vaut pas pour les autres discussions, dont la fiche est réécrite toutes les 6 s |
| Fin (/fil) | Le vert balaie la barre comme la vague, avec un flash blanc (75 %) sur le front, puis 18 confettis partent en arc depuis le bout et retombent (900 ms, sans sortir des 18 px), et le curseur fait un petit « pop » (500 ms) |
| Jauge critique | Barre rouge (90 % et plus) : double battement blanc toutes les 1,6 s |

**Le dessin n'est pas une page vivante.** Quand la barre change, le SVG est regénéré. Pour que ça reste fluide, chaque nouveau dessin démarre depuis l'ancien état :
- le curseur glisse depuis son ancienne position, avec une courbe souple à léger rebond, en 500 ms ;
- les nouvelles colonnes apparaissent comme décrit plus haut ;
- les pixels qui changent de couleur partent de l'ancienne.

**Taille.** Un SVG doit rester sous 131 072 caractères. Au-delà, les pixels passent à 4 px (puis 5 px). Les pixels sont regroupés par couleur et par classe CSS partagée au lieu d'un style par pixel.

**Moins d'animations.** Si l'option « afficher les animations » de Windows est coupée (`prefers-reduced-motion`), les étincelles, la bande de lumière, la tête de lecture, le flash, les confettis et le battement disparaissent. Seuls les fondus restent ; une barre en attente reste pâle, sans respirer.

**Réglage « Animations » (1.0.4).** Choisi sur maquette le 12/10/2026 (« Réduites : effets d'un instant »), vérifié sur le bureau le même jour.
- **Réduites.** Les boucles ne sont pas dessinées du tout : étincelles, bande de lumière, tête de lecture, respiration, battement de la jauge critique. L'image est plus légère et le bureau n'a plus rien à animer en continu. Les effets d'un changement jouent une fois : apparition des colonnes neuves, vague de couleur, fanfare de fin, glissement du curseur. Une barre en attente reste pâle.
- **Coupées.** La barre est dessinée comme si rien ne venait de changer : des images fixes.
- Le réglage de Windows s'ajoute à celui-ci.

## 8. /jauge

- **Ce qu'elle affiche.** Trois mesures côte à côte, dans le style du §7 :
  - **Contexte** : % et « 84 k / 200 k jetons » ;
  - **Limite 5 h** : % et « remise à zéro dans 1 h 52 » ;
  - **Limite 7 jours** : % et « remise à zéro dans 3 j 4 h ».
- **Couleur de chaque barre.** Vert sous 50 %, jaune de 50 à 75 %, orange de 75 à 90 %, rouge à partir de 90 %.
- **Mise à jour.** Les chiffres viennent de `session.measure` (à chaque réponse) et de `$.session.usage()` au démarrage. Le compte à rebours est recalculé toutes les 30 s.
- **Mesure absente.** Une mesure que Claude Code ne donne pas affiche « — » (par exemple sans abonnement, ou avant la première réponse).
- **Boutons.** À droite, « Passer le relais » si /relais est allumé, et « Améliorer le prompt » si /plume est allumé. Pendant l'amélioration, le bouton affiche « Amélioration… » ; ensuite, « Revenir à mon texte » pendant 30 s.

## 9. /fil

### 9.1 La ligne de Claude

**Avancement.** C'est le nombre de tâches finies sur le nombre de tâches de la liste en cours, lue dans les appels `TaskCreate`, `TaskUpdate` et `TodoWrite` de la boucle principale.
- **Consigne à Claude.** Quand /fil est allumé, un `prompt.compose` ajoute aux consignes : « découpe en tâches tout travail de plus de 2 étapes, et demande la même chose à chaque sous-agent que tu lances ».
- **Sans liste de tâches** (réponse courte) : l'avancement est une estimation qui monte vite puis ralentit, sans dépasser 90 % (`0,9 × (1 − e^(−t/40 s))`). Il passe à 100 % à la fin. Le compteur affiche alors « ≈ » au lieu de « n / m ».
- **Couleur.** Elle dépend des tâches finies, jamais de la position du curseur pendant qu'il glisse. Sans cette règle, à 1/3 et à 2/3, le léger rebond ferait clignoter la couleur.

**Au-dessus de la barre.** « Tâche n · nom de la tâche », dans la couleur de la barre.

**Dans le curseur.** Un mot, tiré de l'outil en cours :

| Outil | Mot |
|---|---|
| Read, NotebookRead | Lecture |
| Grep, Glob | Recherche |
| Edit, Write, NotebookEdit | Écriture |
| Bash, PowerShell | Commande |
| Agent, Workflow | Délégation |
| WebFetch, WebSearch, navigateur | Web |
| AskUserQuestion | Question |
| Skill | Méthode |
| outil d'un connecteur (MCP) | Connecteur |
| aucun outil (le modèle écrit ou réfléchit) | Réflexion |

Un outil absent de la liste donne « Action ». À la fin, le curseur affiche « ✓ Fini ».

**À droite.** Le compteur (« 3 / 7 ») et le chrono depuis le début de la réponse. Remplacé le 12/10/2026 : le chrono n'a plus de colonne, il est dans l'étiquette de la barre (« Lecture · 1:48 »). En 1.0.5, il n'y apparaissait qu'au survol, par une `Box` en `position: absolute` révélée par `hover` : le bureau la dessine en bulle au-dessus de la barre (vu sur capture), pas sur l'étiquette. Depuis 1.0.6 (choisi sur aperçu), il y est toujours et tourne tout seul : des colonnes de chiffres qui défilent par crans (`steps`), calées sur l'horloge (`--t` et le début du travail), sans redessiner l'image ; elle l'est seulement à 10 min puis 1 h, qui ajoutent une colonne. Depuis 1.0.7, la bande n'est plus redessinée chaque seconde sur le bureau : il la reconstruit en entier à chaque redessin, boutons et images compris (lu dans son code), ce qui faisait clignoter le bouton sous la souris et reculer le temps à l'heure du premier dessin. Elle ne l'est plus que quand une barre change, s'assoupit ou gagne une colonne (10 min, 1 h), et chaque image porte l'heure de son dessin (`--t`, `--u`), même rendue par le cache. Un SVG en `foreignObject` avec compteurs CSS (`@property`) ne s'affiche pas dans une image (essayé). Chiffres de 6,4 px, deux-points de 2,6 px, mot estimé lettre par lettre et collé au temps (mesuré sur aperçu). Une fois fini, le temps s'arrête (« ✓ Fini · 3:42 »), le temps que la barre s'efface (5 s). Animations « Coupées » : pas de temps pendant le travail (image fixe). Au terminal, « Lecture · 1:48 » redessiné chaque seconde.

### 9.2 Les sous-agents

- **Une ligne par sous-agent**, de son lancement (`agent.spawn`) à sa fin. Elle est reconnue par l'`agentId` de ses appels d'outils. Son libellé est la description donnée au lancement.
- **Même barre que Claude.** Même règle d'avancement (sa propre liste de tâches, sinon l'estimation), mêmes mots d'étape, même fin en vert.
- **Après la fin.** Un sous-agent qui finit pendant que Claude travaille encore : sa ligne reste 4 s, puis disparaît. À la fin de la réponse, toutes les lignes restent (voir 9.4).

### 9.3 Les autres discussions

- **Écriture.** Chaque session écrit son état dans `~/.claude/pupitre/sessions/<id de session>.json` : titre, avancement, tâche, étape, chrono, date. C'est fait au plus une fois par seconde, et seulement quand quelque chose change.
- **Lecture.** Chaque session lit les fichiers des autres toutes les 2 s. Elle ignore ceux qui n'ont pas bougé depuis plus de 15 s (session fermée ou au repos) et supprime ceux de plus d'une heure.
- **Affichage.** Sous « Autres discussions », une ligne fine par session : titre (sinon le nom du dossier du projet), tâche, barre fine (10 px), compteur et chrono.
- **Fin.** Une discussion vue en cours puis finie garde sa ligne (verte, « Terminé », chrono arrêté), même une fois fermée, jusqu'à sa croix **×**, et au plus 5 s après sa fin (1.0.5). Fermée, elle ne revient qu'avec une nouvelle demande dans cette discussion. Une discussion disparue en plein travail (plantage) part au bout de 15 s, comme avant.
- **Plantage.** Un fichier illisible ou à moitié écrit est ignoré : l'écriture passe par un fichier temporaire, ensuite renommé.

### 9.4 Fin et son

- **Fin.** Quand la réponse se termine, tout passe au vert, puis s'efface 5 s après (1.0.5). Une croix, au bout de la première ligne, retire les barres /fil : `Button` de `label` « × ». Le bureau ne dessine d'un `Button` que son `label` : ni son contenu, ni `role: 'dismiss'` dans cette bande (vérifié sur capture le 11/10/2026). Limite : le moteur n'offre pas de nom accessible distinct du libellé, la croix est donc annoncée « × » ; sinon elles sont remplacées à la demande suivante (demande du 11/10/2026).
- **Rechargement.** Au démarrage de la session (ou au rechargement du mod), les lignes /fil en cours sont retirées (on ne peut plus les suivre) ; les lignes finies restent, avec leur croix.
- **Son.** Le carillon `assets/carillon.wav` est joué si la réponse a duré plus de 30 s. C'est un carillon doux de 2 notes (mi puis la, environ 0,6 s, sons sinusoïdaux qui s'atténuent), fabriqué par `outils/carillon.py`. Rien n'est téléchargé. Le moteur ne joue de son que sur macOS : sous Windows, le mod fait lire le fichier par PowerShell (`Media.SoundPlayer`).

## 10. /cap, /relais, /plume

### /cap
- **Déclenchement.** Taper `/cap` envoie une demande visible qui contient toute la consigne : relire la conversation, puis poser de 1 à 4 questions avec la fenêtre à choix.
- **Questions.** Prochaine étape, priorité, ce qu'on laisse de côté, et toute autre décision ouverte. Chacune a des options concrètes et une option recommandée.
- **Ensuite.** Je reprends le travail sur le cap choisi.

### /relais (bouton « Passer le relais »)
1. **La demande.** Le bouton envoie la demande « Passer le relais », qui contient toute la consigne : écrire `relais.md` à la racine du projet ouvert (80 lignes au plus).
   - Contenu de `relais.md` : voir §11 ; l'état actuel est vérifié juste avant d'écrire (git status, branche, avance sur le dépôt distant, dernier commit, tests), pas de mémoire.
   - Il ne contient ni identifiant d'entreprise, ni nom réel, ni chemin du dossier personnel de l'utilisateur.
   - **Jamais dans git** (décision du 11/10/2026, après la publication par erreur d'un `relais.md`) : s'il n'est pas déjà ignoré, Claude l'ajoute à `.git/info/exclude`, exclusion propre à l'ordinateur qui ne modifie pas le projet. S'il est déjà suivi, Claude le signale. Pour reprendre ailleurs, on copie le fichier.
2. **La vérification.** À la fin de cette réponse, le mod vérifie que `relais.md` a été modifié pendant la réponse.
   - **Oui :** il lance `/clear`, puis met dans la zone de saisie la phrase de reprise : vérifier que l'état décrit est toujours vrai, résumer en 3 lignes, puis reprendre aux prochaines étapes, ou poser la question en attente si le statut est ATTENDRE.
   - **Non :** il ne vide rien et affiche « Le relais n'a pas été écrit : la conversation est conservée. »

### /plume (bouton « Améliorer le prompt »)
1. **Lecture du brouillon** (`$.prompt.read()`). S'il est vide : « Écris d'abord ta demande. »
2. **Inventaire.** Le mod liste les skills et commandes (`$.command.list()`), les outils et connecteurs (`$.tool.list()`) et les sous-agents (`$.agent.list()`), avec nom et description. Ceux dont le nom ou la description reprend des mots de la demande (5 lettres et plus) passent en tête, avant la coupe à 150.
3. **Contexte récent** (`$.session.messages()`, `$.session.root()`) : le nom du dossier, la dernière demande (600 caractères au plus) et la fin de la dernière réponse de Claude (1 200 caractères au plus), sans les consignes jointes par les mods (`<system-reminder>`). Sans conversation lisible, la réécriture se fait sur la demande seule.
4. **Réécriture.** Le tout est envoyé à `$.model.complete` (modèle `sonnet`, sinon le modèle de la session), avec ces consignes :
   - garder la langue et l'intention, et mot pour mot les contraintes, noms, chiffres et citations ;
   - rendre la demande précise : but, contexte, contraintes, résultat attendu ;
   - ne rien inventer ; ne se servir du contexte récent que pour préciser ce que désignent « ça », « les barres », « ce fichier »… ;
   - si un point essentiel reste ambigu, ajouter une phrase qui demande à Claude de poser la question avant d'agir ;
   - garder à peu près la même longueur (2 ou 3 phrases de plus au plus pour une demande de quelques mots) ;
   - citer les skills, commandes, connecteurs ou sous-agents utiles, par leur nom exact et seulement s'ils servent ;
   - répondre uniquement par le texte réécrit.
5. **Remplacement** (`$.prompt.fill`, mode `replace`). Le texte d'origine reste derrière le bouton « Revenir à mon texte » jusqu'à l'envoi (crochet `prompt.submit`), même si on retouche la réécriture.
6. **Erreur.** Si l'appel échoue, le brouillon reste intact et le message « Amélioration impossible : réessaie » s'affiche.

## 10 bis. Évolutions du 11/10 (après la vidéo d'inspiration)

Elles remplacent ce qui, plus haut, les contredit.

- **Une ligne par travail (9.1 à 9.3).** Mêmes colonnes partout : icône (● en cours, ✓ fini, ↳ sous-agent), titre (le début de la demande ; pour une autre discussion, « demande · dossier »), barre de 18 px avec l'étape dans une étiquette, pourcentage, temps, croix. La place de la croix est gardée sur chaque ligne : toutes les barres ont la même longueur. Les autres discussions sont dans la même liste, sous celles de cette discussion ; leur fiche porte aussi la demande et le mot d'étape.
- **Sous-agents.** Un sous-agent fini reste affiché, vert, jusqu'à la croix (plus de départ au bout de 4 s).
- **Claude attend ta réponse (1.0.5, demande du 12/10/2026, piste A choisie sur aperçu).** De l'appel à `AskUserQuestion` jusqu'à son résultat (`attente` du suivi ; l'étiquette « Question », elle, restait jusqu'à l'outil suivant), la barre passe à l'orange (`PALETTE_APPEL`, l'orange de la jauge), pulse doucement (`.p`, 1,2 s, sur toute la partie remplie), sans étincelles, bande de lumière ni tête de lecture, et ne s'assoupit jamais. L'étiquette dit « Ta réponse ? », l'icône est un « ? » orange. Animations « Coupées » : orange fixe ; Windows « moins d'animations » arrête aussi l'impulsion. L'attente passe dans la fiche des autres fenêtres (`attente`, absente des fiches d'avant : faux).
- **Autres discussions (1.0.5, demande du 12/10/2026, pistes C et D).** Les autres conversations ont l'icône ⧉ (en cours comme finies ; « ? » quand leur Claude attend), et un titre discret « Autres discussions » les précède dès qu'il y en a une. Pas de trait : la bande ne trace que des cadres entiers.
- **Barres finies (1.0.5, demande du 12/10/2026, remplace la ligne précédente).** Toute barre finie (Claude, sous-agent, autre discussion) s'efface toute seule 5 s après être passée au vert (`DUREE_FINIE_MS`), comme si on avait cliqué sa croix ; la croix la retire plus tôt. Le tic d'une seconde s'en charge ; une barre en cours ne part jamais.
- **Cache.** À la fin de chaque réponse, `turn.complete` donne `usage` : « Cache 82 % » (lu dans le cache / entrée totale) s'affiche à gauche de la ligne des boutons quand la jauge est allumée.
- **/cap automatique.** `/cap` bascule `cap`, comme les autres commandes. Allumé, un `prompt.submit` joint `CONSIGNE_CAP_AUTO` au `context` de chaque message de l'utilisateur (sauf une commande « / ») : à la fin du travail, Claude pose « Et maintenant, on fait quoi ? » avec AskUserQuestion et 3 suites. Vérifié dans le terminal : le contexte d'un message de l'utilisateur arrive à Claude, alors que le prompt système d'un mod (`prompt.compose`, `prompt.context`) n'est pas consulté.
- **Relais au bon moment.** Réglage `{ seuil, auto }` gardé dans `$.store` (clé `relais`), seuil de 30 à 90 % par pas de 5, 60 % par défaut. À chaque `session.measure`, au-delà du seuil : le bouton devient « Passer le relais · 62 % » et une notification prévient une fois par dépassement ; en automatique, le relais se lance à la fin du tour (jamais au milieu du travail). Le mod suit le tour qui porte la consigne du relais (`turnId`), car la demande d'un mod ne part qu'au repos ; il cherche `relais.md` à la racine du projet (`$.session.root()`).
- **relais.md.** Première ligne `<!-- Conversation d'origine : claude --resume <id> -->`, puis `STATUT : À REPRENDRE` ou `ATTENDRE`, puis Objectif, Contraintes permanentes, Dernière demande (mot pour mot), Ce qui a été fait, État actuel (vérifié), Comment vérifier, Décisions, Pistes écartées, Prochaines étapes (avec la question exacte si ATTENDRE), Blocages, Fichiers clés (chemins relatifs). La phrase de reprise vérifie l'état, puis repart des prochaines étapes, ou pose la question en attente si le statut est ATTENDRE.

## 11. Cas particuliers et limites

- **Terminal.** Sans élément `Svg`, la bande est dessinée en caractères : blocs `█▓▒░` dans les mêmes couleurs, et le mot d'étape après la barre. Pas d'animation.
- **Pas d'abonnement.** Les limites 5 h et 7 jours affichent « — ». On le saura au premier essai.
- **Animations relancées.** Le SVG est un cadre isolé : quand il est regénéré, ses animations repartent du début. La règle « démarrer depuis l'ancien état » (§7) masque ce saut.
- **Session sans boîte de saisie** (`claude -p`, SDK) : /plume et la fin de /relais ne font rien et le disent.
- **Erreurs.** Une erreur dans un hook ne doit jamais bloquer Claude : chaque hook se protège et laisse passer `next(e)`.
- **Données.** Rien ne sort du PC, sauf l'appel au modèle de /plume, qui passe par Claude comme le reste de la conversation.

## 12. Vérification

- **Tests automatiques** (`claude plugin test`) sur les fonctions pures :
  - SVG : taille sous la limite, couleurs selon l'avancement, trame, positions du curseur ;
  - mots d'étape ;
  - estimation sans liste de tâches ;
  - comptes à rebours (« 1 h 52 », « 3 j 4 h », « — ») ;
  - lecture des listes de tâches (`TaskCreate`, `TaskUpdate`, `TodoWrite`) ;
  - fichier commun : écriture atomique, sessions trop anciennes ignorées ;
  - bascules de /pupitre et des commandes ;
  - enchaînement de /relais : avec et sans `relais.md` modifié.
- **Contrôles du code.** `claude plugin validate` et contrôle des types (`tsc`).
- **Essai réel**, dans cette session, avec le rechargement à chaud. On allume chaque commande, puis on vérifie :
  - un vrai travail avec tâches et sous-agent ;
  - une deuxième fenêtre ;
  - le son ;
  - /relais dans un vrai projet ;
  - /plume sur une demande dictée.

## 13. Installation

**Sur chaque PC, une fois.** Dans un terminal, lancer `claude`, puis taper :

```
/plugin install pupitre --marketplace Eiyuo/Claude-Mods
```

Répondre `y` pour ajouter la place de marché, et choisir la portée « user ». Le mod marche ensuite aussi dans l'onglet Code de l'application.

**Mise à jour.** `git pull` dans le dépôt, puis mise à jour du plugin. La commande exacte sera vérifiée et écrite dans le README.

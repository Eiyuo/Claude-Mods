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
| Rangement | Dépôt GitHub privé `Eiyuo/Claude-Mods`, à part du projet REX. Installé une fois sur chaque PC, il vaut pour tous les projets |
| /fil, ce qui est mesuré | Tâches finies sur tâches prévues, une ligne pour Claude et une par sous-agent (option 3) |
| /fil, autres fenêtres | Une ligne fine par autre discussion qui travaille (option 1) |
| /fil, style | Celui du curseur d'effort « Ultracode » de l'application : piste claire, pixels colorés, curseur. Dans la version « Après » : trame ordonnée, relief, scintillement doux, reflet en biais, apparition des pixels |
| /fil, couleurs | Violet de 0 à 33 %, bleu de 33 à 66 %, turquoise de 66 à 99 %, **vert quand c'est terminé** |
| /fil, curseur | Il prend la couleur foncée de la barre et contient **un mot** décrivant l'étape en cours, en blanc |
| /fil, sous-agents | Même barre que Claude |
| /fil, son | Carillon doux de 2 notes à la fin d'une réponse, **seulement si elle a pris plus de 30 s** |
| /jauge, couleurs | Violet sous 75 %, orange de 75 à 90 %, rouge au-delà. Partie remplie pleine, sans trous |
| /cap | Seulement quand on tape /cap |
| /relais | `relais.md` à la racine du projet ouvert, **enregistré dans git** (commit local ; l'envoi sur GitHub reste à la demande) |
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
- **La zone de saisie.** `$.prompt.read()` lit le brouillon, `$.prompt.fill({ text, mode })` le remplace. `$.prompt.submit()` envoie une demande. Un hook `prompt.submit` peut y ajouter un `context` invisible.
- **Les commandes.**
  - `$.command.register` déclare une commande, et un hook `command.run` y répond.
  - `$.command.run({ command: 'clear' })` lance `/clear`.
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
- Ils sont rangés dans `$.store`, sous la clé `reglages = { jauge, fil, relais, plume, cap }` (booléens). Au premier usage, tout est éteint.
- `/pupitre` met aussi `cap` à vrai : il n'a pas d'élément visible, mais il sert à `/pupitre` pour savoir si « tout est allumé ».
- Chaque changement affiche un message, par exemple « Pupitre : fil éteint ».
- `/relais` et `/plume` allumés sans `/jauge` : la jauge s'affiche quand même, réduite à leurs boutons, qui doivent rester accessibles.

## 6. La bande au-dessus de la zone de texte

- **Ordre.** De haut en bas : les autres discussions, /fil, puis la jauge. La jauge reste toujours au plus près de la zone de texte (demande du 11/10/2026).
- **Jauge sur une ligne.** « Contexte ▰▰▱ 86 % · Limite 5 h ▰▱▱ 14 % ↻ 2 h 12 · Limite 7 jours ▰▰▱ 31 % ↻ 5 j 5 h », puis les boutons à droite. Les barres prennent la place qui reste (20 colonnes au plus) ; sous 6 colonnes, les comptes à rebours « ↻ » quittent la ligne. Le détail (jetons, phrase de remise à zéro) est dans l'info-bulle de chaque barre.
- **Taille des barres.** Chaque `Svg` reçoit `width` et `height` : sans eux, le bureau donne 150 px de haut au cadre interactif.
- **Affichage.** Rien ne s'affiche quand tout est éteint, ou quand /fil n'a rien à montrer et que la jauge est éteinte.
- **Pas de redessin à vide.** La bande n'est redessinée que quand une valeur change : nouvelle mesure, tâche, étape, sous-agent, autre session, ou chaque seconde pour le chrono quand /fil est actif. Le scintillement et le reflet tournent seuls dans le SVG.
- **Survey.** Quand `hasSurvey` est vrai, la bande cède la place.
- **Hauteur.** Si `maxRows` est trop petit (moins de 3), la jauge ne garde que ses boutons ; sous 8, /fil ne montre plus que la ligne de Claude.

## 7. Style des barres (commun à /fil et /jauge)

**Piste.**
- Fond clair, 0,5 px de contour.
- Coins arrondis : 7 px pour /fil (hauteur 22 px), 4 px pour la jauge (hauteur 10 px).

**Pixels.** Des carrés de 3 px pour /fil et de 2 px pour la jauge, sans espace entre eux : la partie remplie est pleine.

**Palettes** (4 nuances, de la plus claire à la plus foncée) :

| Palette | Nuances |
|---|---|
| Violet | #B2A6EE · #9687E4 · #7C6CDC · #6452D0 |
| Bleu | #84A8EC · #6490E6 · #4678DC · #2C60C8 |
| Turquoise | #5CC4BC · #38B2AA · #1E9C96 · #10827C |
| Vert | #7CC280 · #58B060 · #3C9C48 · #288037 |
| Orange (jauge) | #F5AA5F · #EE9646 · #E8862A · #D6761E |
| Rouge (jauge) | #E66E6E · #DE5A5A · #D64545 · #C43737 |

**Disposition, version « Après ».**
- **Dégradé en trame.** Du clair au foncé en allant vers le bord avant, par une trame ordonnée (matrice de Bayer 4 × 4) qui choisit entre deux nuances voisines. Quand c'est terminé, le dégradé est uniforme.
- **Relief.** La rangée du haut est éclaircie de 16 %, celle du bas assombrie de 12 %.
- **Bord avant.** Les 10 derniers pixels sont éclaircis, jusqu'à +22 %.

**Animation** (CSS dans le SVG, seulement `opacity`, `transform` et `fill`) :

| Effet | Détail |
|---|---|
| Scintillement | Chaque pixel varie doucement en clarté (±6 %), avec sa propre période (de 1,2 à 2,8 s) et son propre décalage |
| Étincelles | Environ 2 % des pixels, au hasard : un éclat blanc de 400 ms, toutes les 1,6 s |
| Reflet | Une bande en biais (pente de 6 % de la hauteur), au bord tramé, qui traverse la partie remplie en 4,6 s. Le décalage entre lignes évite qu'elles se reflètent ensemble |
| Apparition | Quand la barre avance, les nouvelles colonnes apparaissent pixel par pixel (décalage de 0 à 220 ms), avec un éclat qui s'éteint en 260 ms |
| Changement de couleur | Fondu pixel par pixel (décalage de 0 à 650 ms) |
| Fin (/fil) | Le vert balaie la barre de gauche à droite (450 ms + 160 ms de décalage), une gerbe de 16 pixels verts jaillit du curseur (700 ms), et le curseur fait un petit « pop » (500 ms) |

**Le dessin n'est pas une page vivante.** Quand la barre change, le SVG est regénéré. Pour que ça reste fluide, chaque nouveau dessin démarre depuis l'ancien état :
- le curseur glisse depuis son ancienne position, avec une courbe souple à léger rebond, en 500 ms ;
- les nouvelles colonnes apparaissent comme décrit plus haut ;
- les pixels qui changent de couleur partent de l'ancienne.

**Taille.** Un SVG doit rester sous 131 072 caractères. Au-delà, les pixels passent à 4 px (puis 5 px), et le scintillement est regroupé par classes CSS partagées (8 rythmes) au lieu d'un style par pixel.

**Moins d'animations.** Si l'option « afficher les animations » de Windows est coupée (`prefers-reduced-motion`), le scintillement, les étincelles, le reflet et la gerbe disparaissent. Seuls les fondus restent.

## 8. /jauge

- **Ce qu'elle affiche.** Trois mesures côte à côte, dans le style du §7 :
  - **Contexte** : % et « 84 k / 200 k jetons » ;
  - **Limite 5 h** : % et « remise à zéro dans 1 h 52 » ;
  - **Limite 7 jours** : % et « remise à zéro dans 3 j 4 h ».
- **Couleur de chaque barre.** Violet sous 75 %, orange de 75 à 90 %, rouge à partir de 90 %.
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

**À droite.** Le compteur (« 3 / 7 ») et le chrono depuis le début de la réponse.

### 9.2 Les sous-agents

- **Une ligne par sous-agent**, de son lancement (`agent.spawn`) à sa fin. Elle est reconnue par l'`agentId` de ses appels d'outils. Son libellé est la description donnée au lancement.
- **Même barre que Claude.** Même règle d'avancement (sa propre liste de tâches, sinon l'estimation), mêmes mots d'étape, même fin en vert.
- **Après la fin.** Un sous-agent qui finit pendant que Claude travaille encore : sa ligne reste 4 s, puis disparaît. À la fin de la réponse, toutes les lignes restent (voir 9.4).

### 9.3 Les autres discussions

- **Écriture.** Chaque session écrit son état dans `~/.claude/pupitre/sessions/<id de session>.json` : titre, avancement, tâche, étape, chrono, date. C'est fait au plus une fois par seconde, et seulement quand quelque chose change.
- **Lecture.** Chaque session lit les fichiers des autres toutes les 2 s. Elle ignore ceux qui n'ont pas bougé depuis plus de 15 s (session fermée ou au repos) et supprime ceux de plus d'une heure.
- **Affichage.** Sous « Autres discussions en cours », une ligne fine par session : titre (sinon le nom du dossier du projet), tâche, barre fine (10 px), compteur et chrono.
- **Plantage.** Un fichier illisible ou à moitié écrit est ignoré : l'écriture passe par un fichier temporaire, ensuite renommé.

### 9.4 Fin et son

- **Fin.** Quand la réponse se termine, tout passe au vert et reste affiché. Un bouton « Fermer », au bout de la première ligne, retire les barres /fil ; sinon elles sont remplacées à la demande suivante (demande du 11/10/2026).
- **Rechargement.** Au démarrage de la session (ou au rechargement du mod), les lignes /fil sont vidées : aucune barre ne reste figée.
- **Son.** Le carillon `assets/carillon.wav` est joué si la réponse a duré plus de 30 s. C'est un carillon doux de 2 notes (mi puis la, environ 0,6 s, sons sinusoïdaux qui s'atténuent), fabriqué par `outils/carillon.py`. Rien n'est téléchargé.

## 10. /cap, /relais, /plume

### /cap
- **Déclenchement.** Taper `/cap` envoie une courte demande visible (« /cap — fixer le cap »). Elle est accompagnée d'une consigne invisible (`context`) : relire la conversation, puis poser de 1 à 4 questions avec la fenêtre à choix.
- **Questions.** Prochaine étape, priorité, ce qu'on laisse de côté, et toute autre décision ouverte. Chacune a des options concrètes et une option recommandée.
- **Ensuite.** Je reprends le travail sur le cap choisi.

### /relais (bouton « Passer le relais »)
1. **La demande.** Le bouton envoie la demande « Passer le relais », avec une consigne invisible : écrire `relais.md` à la racine du projet ouvert, puis l'enregistrer dans git.
   - Contenu de `relais.md` : date ; où on en est ; ce qui a été fait ; ce qui reste à faire ; décisions prises (et pourquoi) ; contraintes et règles à respecter ; blocages et problèmes ; fichiers clés ; prochaine action précise.
   - Il ne contient ni l'identifiant d'entreprise ni le nom réel de l'utilisateur.
   - L'enregistrement dans git est un commit `docs: relais`, sans envoi sur GitHub.
2. **La vérification.** À la fin de cette réponse, le mod vérifie que `relais.md` a été modifié pendant la réponse.
   - **Oui :** il lance `/clear`, puis met dans la zone de saisie : « Lis relais.md à la racine du projet et reprends là où on s'est arrêtés. Commence par me résumer en 3 lignes où on en est. »
   - **Non :** il ne vide rien et affiche « Le relais n'a pas été écrit : la conversation est conservée. »
3. **Hors projet git.** `relais.md` est écrit quand même. Le commit est sauté, et la réponse le signale.

### /plume (bouton « Améliorer le prompt »)
1. **Lecture du brouillon** (`$.prompt.read()`). S'il est vide : « Écris d'abord ta demande. »
2. **Inventaire.** Le mod liste les skills et commandes (`$.command.list()`), les outils et connecteurs (`$.tool.list()`) et les sous-agents (`$.agent.list()`), avec nom et description.
3. **Réécriture.** Le brouillon est envoyé à `$.model.complete` (modèle `sonnet`, sinon le modèle de la session), avec ces consignes :
   - garder la langue et l'intention ;
   - rendre la demande précise : but, contexte, contraintes, résultat attendu ;
   - ne rien inventer ;
   - citer les skills, commandes, connecteurs ou sous-agents utiles, par leur nom exact et seulement s'ils servent ;
   - rester court ;
   - répondre uniquement par le texte réécrit.
4. **Remplacement** (`$.prompt.fill`, mode `replace`). Le texte d'origine est gardé 30 s derrière le bouton « Revenir à mon texte ».
5. **Erreur.** Si l'appel échoue, le brouillon reste intact et le message « Amélioration impossible : réessaie » s'affiche.

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
  - /relais dans le projet REX ;
  - /plume sur une demande dictée.

## 13. Installation

**Sur chaque PC, une fois.** Dans un terminal, lancer `claude`, puis taper :

```
/plugin install pupitre --marketplace Eiyuo/Claude-Mods
```

Répondre `y` pour ajouter la place de marché, et choisir la portée « user ». Le mod marche ensuite aussi dans l'onglet Code de l'application.

**Mise à jour.** `git pull` dans le dépôt, puis mise à jour du plugin. La commande exacte sera vérifiée et écrite dans le README.

# Claude-Mods

Mes mods pour **Claude Code** : ajouts à l'interface et au comportement de Claude, installés une fois et valables dans tous mes projets.

| Mod | Rôle | État |
|---|---|---|
| **pupitre** | Une bande au-dessus de la zone de texte : ce qui reste (contexte, limites), où en est Claude, et des raccourcis pour fixer la suite, passer le relais ou améliorer une demande | Conception validée, réalisation en cours |

---

## pupitre

### En bref

| Commande | Ce qu'elle fait |
|---|---|
| `/pupitre` | Allume tout d'un coup. Si tout est déjà allumé, éteint tout |
| `/jauge` | Allume ou éteint la jauge (contexte, limites 5 h et 7 jours) |
| `/fil` | Allume ou éteint les barres de progression de Claude et de ses sous-agents |
| `/relais` | Allume ou éteint le bouton « Passer le relais » |
| `/plume` | Allume ou éteint le bouton « Améliorer le prompt » |
| `/cap` | Allume ou éteint le cap automatique : à la fin de chaque réponse, Claude te demande « Et maintenant, on fait quoi ? » avec 3 suites |

À chaque changement, un petit message confirme ce qui est allumé ou éteint, par exemple « Pupitre : fil éteint ». Les réglages sont gardés d'une session à l'autre.

**Sans taper de commande : le bouton « Réglages ».** Il est au bout de la ligne des boutons. Un clic déplie juste en dessous la ligne « Pupitre : ✓ Jauge · ✓ Fil · ✓ Relais · ✓ Plume · ✓ Cap · Tout éteindre · Replier », et, quand le relais est allumé, la ligne « Relais à : − 60 % + · ○ Automatique ». Chaque bouton allume (✓) ou éteint (○) sa fonction ; « Tout éteindre » devient « Tout allumer » dès qu'une fonction est éteinte ; « Replier » range la ligne. Si tu éteins tout, la bande disparaît : tape `/pupitre` pour la rallumer.

### La jauge (`/jauge`)

Une seule ligne, avec trois petites barres :

- **Contexte** : la part de la mémoire de conversation de Claude déjà remplie (par exemple « 42 % · 84 k / 200 k jetons »). Quand elle approche de 100 %, Claude commence à oublier le début : c'est le moment de passer le relais.
- **Limite 5 h** : ta consommation sur la fenêtre de 5 heures, et le temps avant sa remise à zéro.
- **Limite 7 jours** : ta consommation sur la semaine, et le temps avant sa remise à zéro.

Les couleurs :

| Couleur | Signification |
|---|---|
| Violet | Moins de 75 % |
| Orange | De 75 à 90 % |
| Rouge | 90 % et plus |

Le symbole **↻** donne le temps avant la remise à zéro. Chaque texte tient sur une seule ligne. Si la fenêtre est trop étroite, la jauge se resserre dans cet ordre : les barres raccourcissent, puis les « ↻ » quittent la ligne, puis les noms deviennent « 5 h » et « 7 jours ».

Claude Code ne fournit les limites 5 h et 7 jours qu'avec un abonnement (Pro, Max, Team…). Sans abonnement, elles affichent « — ».

Juste sous la jauge, une ligne de boutons, calée à droite : ceux de `/relais` et `/plume` quand ils sont allumés, puis « Réglages ». À gauche, « Cache 82 % » : la part de ta dernière demande déjà gardée en mémoire chez Anthropic, donc moins chère et plus rapide.

### Le fil (`/fil`)

**Une ligne par travail.** Toutes les lignes ont les mêmes colonnes, pour que tout reste aligné :

- un point (« ✓ » quand c'est fini) ;
- le début de ta demande, par exemple « Analyse le dossier radar… » ;
- la barre : des pixels colorés qui scintillent, un reflet qui la traverse, et une étiquette au bout, avec l'étape en un mot (Lecture, Recherche, Écriture, Commande, Délégation, Web, Question, Réflexion…) ;
- le pourcentage et le temps écoulé ;
- la croix **×**, une fois le travail fini. Sa place est gardée sur chaque ligne : toutes les barres ont la même longueur.

**Comment la barre avance.** Si Claude tient une liste de tâches, la barre avance à chaque tâche finie. Sinon (c'est le cas aujourd'hui : Claude Code ne lui donne pas d'outil de liste de tâches), elle avance par estimation : elle ralentit vers 90 %, puis passe à 100 % à la fin.

**Les couleurs suivent l'avancement :**

| Avancement | Couleur |
|---|---|
| 0 à 33 % | Violet |
| 33 à 66 % | Bleu |
| 66 à 99 % | Turquoise |
| Terminé | Vert, avec « ✓ Fini » et une petite gerbe de pixels |

**Où.** Les barres du fil s'affichent au-dessus de la jauge.

**Les sous-agents.** Quand Claude délègue une partie du travail, chaque sous-agent a sa ligne juste sous celle de Claude (« ↳ 1 · sa description »), avec la même barre. Quand il finit, sa ligne passe au vert et reste affichée jusqu'à la croix.

**À la fin.** Quand Claude a fini de répondre, les barres passent au vert et restent affichées. La croix **×** au bout de la ligne de Claude les retire. Sinon, elles sont remplacées à ta demande suivante. Dès que 2 barres ou plus sont finies (les tiennes comme celles des autres discussions), le bouton **« Effacer les barres finies »** apparaît sur la ligne des boutons : il retire toutes les barres vertes d'un coup et garde celles en cours.

**Les autres discussions.** Si une autre fenêtre de discussion travaille en même temps, elle apparaît dans la même liste, avec le nom de son dossier : « Ajoute du beurre… · essai-relais ». Tu suis ainsi tout ce qui tourne, sans changer de fenêtre. Quand elle a fini, sa ligne passe au vert et reste affichée ; la croix **×** au bout de la ligne la retire.

**Le son.** Un carillon doux de deux notes sonne quand Claude a fini, si la réponse a pris plus de 30 secondes. Pas de son pour les réponses rapides.

Si Windows demande moins d'animations, le scintillement, le reflet et la gerbe sont coupés ; les barres restent lisibles.

### Fixer le cap (`/cap`)

Tape `/cap` pour allumer (ou éteindre) le cap automatique. Une fois allumé, à la fin de chaque réponse, quand le travail demandé est fini, Claude te demande dans la fenêtre à choix : « Et maintenant, on fait quoi ? », avec 3 suites possibles, sa recommandation en premier. Tu choisis, ou tu tapes autre chose, et il repart.

Pour ça, une courte consigne part avec chacun de tes messages (tu ne la vois pas). Elle ne part pas avec une commande comme `/fil`.

### Passer le relais (`/relais`)

Quand la conversation devient longue (jauge « Contexte » qui se remplit), clique sur **« Passer le relais »** :

1. Claude écrit le fichier **`relais.md`** à la racine du projet ouvert, avec :
   - une ligne pour rouvrir l'ancienne conversation (`claude --resume …`) ;
   - un statut : « À REPRENDRE », ou « ATTENDRE » si la suite dépend d'une décision de ta part ;
   - l'objectif ;
   - les contraintes permanentes ;
   - ce qui a été fait ;
   - l'état actuel ;
   - les décisions prises, et pourquoi ;
   - les prochaines étapes ;
   - les blocages ;
   - les fichiers clés.
2. Il l'enregistre dans git (commit), sans l'envoyer sur GitHub. Pour l'envoyer, demande-le, comme d'habitude.
3. La conversation est vidée, et la zone de texte est préremplie avec la phrase de reprise : Claude résume en 3 lignes où on en est, puis reprend aux prochaines étapes sans refaire ce qui est fait (ou attend ta décision si le statut est « ATTENDRE »).
4. Tu n'as plus qu'à appuyer sur Entrée : la nouvelle conversation repart avec tout l'essentiel, et une mémoire neuve.

Comme `relais.md` est dans git, tu peux passer le relais au bureau, faire `git pull` chez toi et reprendre exactement au même endroit.

Si `relais.md` n'a pas pu être écrit, la conversation n'est pas vidée et un message te prévient.

**Au bon moment.** Dans « Réglages », choisis ton seuil (60 % par défaut, de 30 à 90 %). Quand le contexte le dépasse, le bouton affiche le contexte (« Passer le relais · 62 % ») et une notification te prévient une fois. En « Automatique », le relais se lance tout seul à la fin de la réponse qui dépasse le seuil.

### Améliorer le prompt (`/plume`)

Tape (ou dicte) ta demande comme elle te vient, puis clique sur **« Améliorer le prompt »** :

1. Ta demande est réécrite pour être plus précise : le but, le contexte, les contraintes et le résultat attendu. Elle garde ta langue et ton intention, et rien n'est inventé.
2. La réécriture s'appuie sur ce que Claude a sous la main (skills, commandes, connecteurs, sous-agents) et cite ceux qui serviront.
3. Le texte amélioré remplace le tien dans la zone de texte. Relis-le, corrige si besoin, puis envoie.
4. Pendant 30 secondes, le bouton **« Revenir à mon texte »** permet d'annuler.

### Où ça marche

| Où | Ce qui s'affiche |
|---|---|
| **Application de bureau Claude** (onglet Code) | Tout, avec les barres animées |
| **Claude dans un terminal** | Tout, mais les barres sont dessinées en caractères (`█▓▒░`), sans animation |
| **`claude -p`, intégrations par programme** | Rien ne s'affiche ; /plume et la fin de /relais ne font rien et le disent |

### Données

Tout reste sur ton PC :
- les réglages ;
- l'avancement partagé entre fenêtres (`~/.claude/pupitre/`) ;
- `relais.md`.

Seule exception : l'amélioration de /plume, qui passe par Claude comme le reste de la conversation.

---

## Installation

À faire **une fois sur chaque PC**. Le dépôt est privé : git te demandera de te connecter à GitHub la première fois.

1. Ouvre un terminal (PowerShell) et lance `claude`.
2. À l'invite de Claude, tape :
   ```
   /plugin install pupitre --marketplace Eiyuo/Claude-Mods
   ```
3. À la question « Add marketplace? », réponds `y`.
4. Choisis la portée **user** (proposée en premier), puis Entrée.
5. Ouvre une nouvelle session dans l'application : tape `/pupitre`.

Cette commande ne marche pas dans l'onglet Code de l'application : il faut passer par Claude dans un terminal. Le mod installé marche ensuite partout, application comprise.

**Mise à jour.** La marche exacte sera confirmée et écrite ici lors du premier essai.

## Pour Claude (développement)

- Conception : `docs/specs/2026-10-11-pupitre-design.md`.
- Pendant le développement, le mod se charge à chaud depuis le dossier des mods de la session.
- Vérifications :
  - `claude plugin validate pupitre` ;
  - `claude plugin test pupitre` ;
  - contrôle des types avec `tsc`.
- Identité des commits : `Eiyuo <203855181+Eiyuo@users.noreply.github.com>`. Ne jamais écrire d'identifiant d'entreprise ni de nom réel dans ce dépôt.

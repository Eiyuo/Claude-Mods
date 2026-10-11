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
| `/cap` | Claude te pose tout de suite ses questions sur la suite |

À chaque changement, un petit message confirme ce qui est allumé ou éteint, par exemple « Pupitre : fil éteint ». Les réglages sont gardés d'une session à l'autre.

### La jauge (`/jauge`)

Trois petites barres, au-dessus de la zone de texte :

- **Contexte** : la part de la mémoire de conversation de Claude déjà remplie (par exemple « 42 % · 84 k / 200 k jetons »). Quand elle approche de 100 %, Claude commence à oublier le début : c'est le moment de passer le relais.
- **Limite 5 h** : ta consommation sur la fenêtre de 5 heures, et le temps avant sa remise à zéro.
- **Limite 7 jours** : ta consommation sur la semaine, et le temps avant sa remise à zéro.

Les couleurs :

| Couleur | Signification |
|---|---|
| Violet | Moins de 75 % |
| Orange | De 75 à 90 % |
| Rouge | 90 % et plus |

Claude Code ne fournit les limites 5 h et 7 jours qu'avec un abonnement (Pro, Max, Team…). Sans abonnement, elles affichent « — ».

À droite de la jauge apparaissent les boutons de `/relais` et `/plume` quand ils sont allumés.

### Le fil (`/fil`)

**La ligne de Claude.** Une barre de progression dans le style du curseur d'effort « Ultracode » : des pixels colorés qui scintillent, un reflet qui la traverse, et un curseur qui avance.

- **Au-dessus de la barre** : la tâche en cours, par exemple « Tâche 3 · Écrire le module /fil ».
- **Dans le curseur** : l'étape, en un mot (Lecture, Recherche, Écriture, Commande, Délégation, Web, Question, Réflexion…).
- **À droite** : le nombre de tâches finies (« 3 / 7 ») et le temps écoulé.

**Comment la barre avance.** Quand /fil est allumé, Claude découpe tout travail de plus de 2 étapes en une liste de tâches, et la barre avance à chaque tâche finie. Pour une réponse courte sans liste, la barre avance par estimation (elle ralentit vers 90 %, le compteur affiche « ≈ »), puis passe à 100 % à la fin.

**Les couleurs suivent l'avancement :**

| Avancement | Couleur |
|---|---|
| 0 à 33 % | Violet |
| 33 à 66 % | Bleu |
| 66 à 99 % | Turquoise |
| Terminé | Vert, avec « ✓ Fini » et une petite gerbe de pixels |

**Les sous-agents.** Quand Claude délègue une partie du travail, chaque sous-agent a sa propre ligne, avec la même barre. Elle disparaît 4 secondes après qu'il a fini.

**Les autres discussions.** Si une autre fenêtre de discussion travaille en même temps, elle apparaît en bas sur une ligne fine, sous « Autres discussions en cours ». Tu suis ainsi tout ce qui tourne, sans changer de fenêtre.

**Le son.** Un carillon doux de deux notes sonne quand Claude a fini, si la réponse a pris plus de 30 secondes. Pas de son pour les réponses rapides.

Si Windows demande moins d'animations, le scintillement, le reflet et la gerbe sont coupés ; les barres restent lisibles.

### Fixer le cap (`/cap`)

Tape `/cap` quand tu ne sais pas trop quelle est la suite, ou pour éviter de demander « c'est quoi la suite ? ».

1. Claude relit la conversation.
2. Il te pose de 1 à 4 questions dans la fenêtre à choix : prochaine étape, priorité, ce qu'on laisse de côté…
3. Tu choisis, et il repart sur ce cap.

### Passer le relais (`/relais`)

Quand la conversation devient longue (jauge « Contexte » qui se remplit), clique sur **« Passer le relais »** :

1. Claude écrit le fichier **`relais.md`** à la racine du projet ouvert, avec :
   - où on en est ;
   - ce qui a été fait ;
   - ce qui reste à faire ;
   - les décisions prises ;
   - les contraintes et règles à respecter ;
   - les blocages ;
   - les fichiers clés ;
   - la prochaine action.
2. Il l'enregistre dans git (commit), sans l'envoyer sur GitHub. Pour l'envoyer, demande-le, comme d'habitude.
3. La conversation est vidée, et la zone de texte est préremplie avec : « Lis relais.md à la racine du projet et reprends là où on s'est arrêtés. »
4. Tu n'as plus qu'à appuyer sur Entrée : la nouvelle conversation repart avec tout l'essentiel, et une mémoire neuve.

Comme `relais.md` est dans git, tu peux passer le relais au bureau, faire `git pull` chez toi et reprendre exactement au même endroit.

Si `relais.md` n'a pas pu être écrit, la conversation n'est pas vidée et un message te prévient.

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

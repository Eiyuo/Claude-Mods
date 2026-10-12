# Claude-Mods

Mods Claude Code personnels. Un seul pour l'instant : `pupitre/`, la bande au-dessus de la zone de texte (jauge, barres de progression, relais, plume, cap). Conception : `docs/specs/2026-10-11-pupitre-design.md`.

## Pour qui

L'utilisateur n'est pas développeur. Il travaille dans l'onglet Code de l'application de bureau Claude et juge sur ce qu'il voit.
- Réponds en français simple, sans jargon.
- Montre plutôt que décrire : une capture ou une maquette avant un long texte.

## Avant de coder

- Dis tes hypothèses. Si la demande a plusieurs sens, présente-les au lieu d'en choisir un en silence. Si c'est flou, demande.
- Si une solution plus simple existe, dis-le, quitte à contredire la demande.
- Le comportement du moteur ne se devine pas : il se lit dans les types générés ou se constate à l'essai sur le bureau. Les commentaires gardent la trace de ce qui a été vu à l'essai (« vérifié sur capture ») ; ne les contredis pas sans nouvel essai.

## Le minimum

- Le moins de code qui répond à la demande : ni option, ni réglage, ni abstraction que personne n'a demandés.
- Pas de gestion d'erreur pour un cas impossible ; mais un souci du mod ne doit jamais bloquer Claude (voir le `.catch` du `tool.call`).

## Changements chirurgicaux

- Chaque ligne modifiée se rattache à la demande. Ne « nettoie » pas le code voisin.
- Garde le style : noms et commentaires en français, un commentaire seulement pour le pourquoi.
- Du code mort repéré en passant : signale-le, ne le supprime pas. Retire seulement ce que ton changement rend inutile.

## Vérifier avant de dire « fini »

Un changement de comportement s'accompagne d'un test dans `pupitre/tests/`. Puis, depuis la racine du dépôt :

```powershell
$cli = (Get-ChildItem "$env:APPDATA\Claude\claude-code" -Filter claude.exe -Recurse | Sort-Object LastWriteTime -Descending)[0].FullName
& $cli plugin validate pupitre
& $cli plugin test pupitre
```

`claude` n'est pas dans le PATH : on prend le plus récent, livré avec l'application. Le contrôle des types (`tsc -p`) ne marche que sur une copie chargée à chaud, la seule où le moteur écrit ses types : `outils/vers-dev.sh <id-de-session>` la crée dans `~/.claude/dev-mods/`.

## Versions et commits

- Un changement visible : la version monte dans `pupitre/.claude-plugin/plugin.json`, et le README suit.
- Commits en français : `feat(pupitre): 1.0.3, <ce qui change pour l'utilisateur>`, `fix(pupitre): …`, `docs: …`.
- Identité : `Eiyuo <203855181+Eiyuo@users.noreply.github.com>`. Jamais d'identifiant d'entreprise, de nom réel ni de chemin de cet ordinateur dans le dépôt.
- `relais.md` et `.claude/settings.local.json` ne sont jamais publiés.

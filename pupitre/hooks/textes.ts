export const CONSIGNE_FIL =
  "Le mod pupitre affiche ta progression au-dessus de la zone de texte. Pour tout travail de plus de 2 étapes, " +
  "commence par créer la liste des tâches avec TaskCreate, passe chaque tâche à in_progress quand tu l'attaques " +
  "puis à completed quand elle est finie (TaskUpdate). Quand tu lances un sous-agent, ajoute à son prompt : " +
  "« Crée d'abord la liste de tes tâches avec TaskCreate et tiens-la à jour avec TaskUpdate. »"

export function chrono(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

// Jointe à chacun de tes messages tant que le cap automatique est allumé (le contexte d'un message de l'utilisateur
// arrive à Claude, le prompt système d'un mod non).
// Les 3 suites ont chacune leur rôle : dans le prolongement seul, aucune ne convenait et la même revenait (vu le 04/11/2026).
// « Une suite écartée ne revient pas » était trop flou : « Publier », pas choisi, est revenu en premier (vu le 05/11/2026).
export const CONSIGNE_CAP_AUTO =
  "Mode cap du mod pupitre : quand tu as fini le travail demandé, et seulement à ce moment-là, termine ta réponse par " +
  "l'outil AskUserQuestion. La question dit en quelques mots où on en est, puis « Et maintenant ? » (par exemple « Plume " +
  "vérifiée sur ton écran. Et maintenant ? »). Propose 3 suites concrètes, tirées de ce qui vient d'être fait et de ce qui " +
  "reste : la suite directe du travail, en premier, avec « (Recommandé) » à la fin de son libellé ; une vérification de ce " +
  "qui reste incertain ou pas encore vu (si tout est vérifié, une deuxième suite utile) ; une autre direction utile, voisine " +
  "du travail. Une suite proposée à la question précédente et pas choisie peut revenir, mais jamais en premier deux fois de " +
  "suite. Chaque libellé : 5 mots au plus, compte-les, et commence par un verbe. Chaque description : ce qui se passera, combien de temps environ, et si c'est irréversible ou visible par " +
  "d'autres (publier, supprimer, envoyer). Ne pose pas cette question si tu en poses déjà une autre ou si le travail n'est " +
  "pas fini."

// Les messages qui ne viennent pas de toi (tâche de fond, /loop ou tâche planifiée, autre session…) : le cap n'y est pas
// joint, sinon une boucle sans surveillance finirait bloquée sur une question. L'application arrive en « sdk » ou
// « unclassified » : on écarte donc les origines automatiques plutôt que de ne garder que le clavier.
const ORIGINES_AUTO = new Set(['task-notification', 'scheduled-trigger', 'peer', 'peer-send-message', 'projects-relay', 'coordinator', 'observer', 'observer-activity', 'channel'])
export const messageHumain = (origine: string): boolean => !ORIGINES_AUTO.has(origine)

// Début de la consigne du relais : c'est à lui que le mod reconnaît le tour qui écrit relais.md.
export const DEBUT_RELAIS = 'Passer le relais. Écris le fichier relais.md'

// relais.md reste sur l'ordinateur : publié avec le dépôt, il exposerait la conversation et les règles de l'utilisateur.
export function consigneRelais(sessionId: string): string {
  return `${DEBUT_RELAIS} à la racine du projet ouvert (remplace-le s'il existe), en français, ` +
    "en 80 lignes au plus, sans récit. " +
    `Première ligne : <!-- Conversation d'origine : claude --resume ${sessionId} -->. Deuxième ligne : « STATUT : À REPRENDRE », ` +
    "ou « STATUT : ATTENDRE » si la suite dépend d'une décision de l'utilisateur. Puis la date, et ces parties : Objectif ; " +
    "Contraintes permanentes (les règles à toujours respecter) ; Dernière demande de l'utilisateur (mot pour mot) ; " +
    "Ce qui a été fait ; État actuel (vérifié juste avant d'écrire, pas de mémoire : git status, branche, avance sur le dépôt " +
    "distant, dernier commit, résultat des tests) ; Comment vérifier (les commandes exactes de test et de validation) ; " +
    "Décisions prises et pourquoi ; Pistes écartées (déjà essayées, à ne pas refaire) ; Prochaines étapes (la première, " +
    "précise ; si le STATUT est ATTENDRE, la question exacte à poser à l'utilisateur et ses options) ; Blocages ; Fichiers " +
    "clés (chemins relatifs au projet). Écris-le pour qu'une conversation neuve, qui n'a rien vu, puisse reprendre exactement " +
    "là. N'y mets ni identifiant d'entreprise, ni nom réel de l'utilisateur, ni chemin de son dossier personnel (écris ~ à la " +
    "place). Ne l'enregistre pas dans git et n'envoie rien sur le dépôt distant : si le dossier est un dépôt git où relais.md " +
    "n'est pas encore ignoré, ajoute la ligne relais.md à .git/info/exclude (exclusion propre à cet ordinateur, le projet " +
    "n'est pas modifié) ; s'il est déjà suivi par git, signale-le. Réponds ensuite en une seule ligne."
}
export const REPRISE_RELAIS =
  "Lis relais.md à la racine du projet et résume-moi en 3 lignes où on en est. Vérifie d'abord que l'état décrit est " +
  "toujours vrai (git status, dernier commit) et signale tout écart. Si son STATUT est ATTENDRE, pose-moi la question en " +
  "attente avec ses options, puis attends ma décision ; sinon, reprends à « Prochaines étapes », sans refaire ce qui est " +
  "déjà fait ni les « Pistes écartées »."

export function relaisEcrit(mtimeMs: number | null, debut: number): boolean {
  return mtimeMs !== null && mtimeMs >= debut
}

export type Capacite = { sorte: 'commande' | 'outil' | 'connecteur' | 'sous-agent'; nom: string; description: string }

export const SYSTEME_PLUME =
  "Tu réécris la demande qu'un utilisateur s'apprête à envoyer à Claude Code, pour qu'elle soit précise et complète. " +
  "Règles : garde sa langue et son intention ; garde mot pour mot ses contraintes, noms, chiffres et citations ; n'invente " +
  "aucun fait, aucun fichier, aucune contrainte ; rends explicites le but, le contexte utile, les contraintes et le résultat " +
  "attendu ; sers-toi du contexte récent de la conversation seulement pour préciser ce que désignent « ça », « les barres », " +
  "« ce fichier »…, sans reprendre d'autres sujets ; s'il manque une information essentielle, ne devine pas : laisse à sa " +
  "place un trou à remplir, « [à préciser : question courte] », que l'utilisateur complétera avant d'envoyer ; garde à peu " +
  "près la même longueur (une demande de quelques mots peut gagner 2 ou 3 phrases, pas plus) ; une demande dictée se " +
  "nettoie : retire les hésitations (« euh », « enfin », « quoi »), les répétitions et les faux départs, et remets la " +
  "ponctuation ; une demande déjà claire reste presque inchangée : corrige seulement ses fautes ; un bug, une nouvelle " +
  "fonction ou une relecture qui tient en plusieurs idées prend sa forme, en lignes courtes : pour un bug, « Ce que je " +
  "fais », « Ce que j'attends », « Ce qui se passe » ; pour une nouvelle fonction, le but puis ce qu'elle doit faire ; pour " +
  "une relecture, ce qu'il faut regarder ; une demande courte reste une phrase ; si un outil, une commande, un connecteur ou un sous-agent dont Claude dispose " +
  "sert vraiment, cite-le par son nom exact (une commande s'écrit avec « / ») ; les passages collés sont remplacés par des " +
  "repères ⟦1⟧, ⟦2⟧… : écris chaque repère une fois, tel quel, là où son passage doit aller, sans recopier le passage ; " +
  "reste direct, en tutoyant ; réponds uniquement par le texte réécrit, entre <<< et >>>, sans titre ni commentaire.\n\n" +
  "Exemples :\n" +
  "« euh donc tu peux mettre le titre là le titre de la page en plus gros enfin plus visible quoi » → " +
  "<<<Rends le titre de la page plus gros et plus visible.>>>\n" +
  "« Ajoute un test pour la fonction calculerTotal quand le panier est vide. » → " +
  "<<<Ajoute un test pour la fonction calculerTotal quand le panier est vide.>>>\n" +
  "« refais-le » (Claude venait de proposer un nouveau plan pour le rapport) → " +
  "<<<Refais le rapport en suivant le plan que tu viens de proposer.>>>\n" +
  "« l'export en pdf il plante quand je clique dessus ça m'affiche une erreur » → " +
  "<<<Bug : l'export en PDF plante.\nCe que je fais : je clique sur l'export en PDF.\nCe que j'attends : un fichier PDF.\n" +
  "Ce qui se passe : une erreur s'affiche, [à préciser : quel message ?]>>>"

// En tête de la demande quand la plume reprend toute la conversation : sinon Claude y répond au lieu de la réécrire.
const CONSIGNE_FORK =
  "Pause dans la conversation : ne réponds pas à ce message et n'utilise aucun outil. L'utilisateur prépare sa prochaine " +
  "demande ; ta seule tâche est de la réécrire, en te servant de toute la conversation ci-dessus comme contexte récent."

const aReecrire = (brouillon: string, blocs: readonly string[]) => `Demande à réécrire :\n<<<\n${brouillon}\n>>>` +
  (blocs.length ? `\n\nPassages collés (ne les recopie pas, écris seulement leur repère) :\n${blocs.map((b, i) => `⟦${i + 1}⟧ :\n${b}`).join('\n\n')}` : '')

// Avec toute la conversation sous les yeux, Claude connaît déjà ses outils et le contexte : la consigne et la demande suffisent.
export function promptFork(brouillon: string, blocs: readonly string[] = []): string {
  return `${CONSIGNE_FORK}\n\n${SYSTEME_PLUME}\n\n${aReecrire(brouillon, blocs)}`
}

const MAX_CAPACITES = 150
const MAX_DEMANDE = 600
const MAX_REPONSE = 1200

// Le dossier, la dernière demande et la fin de la dernière réponse (là où Claude conclut ou pose sa question), sans les
// consignes jointes par les mods.
export function contexteRecent(messages: readonly { role: string; text: string }[], dossier: string): string {
  const propre = (t: string) => t.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '').trim()
  const dernier = (role: string) => [...messages].reverse().map(m => (m.role === role ? propre(m.text) : '')).find(Boolean) ?? ''
  const demande = dernier('user').slice(0, MAX_DEMANDE)
  const reponse = dernier('assistant').slice(-MAX_REPONSE)
  return [`Dossier du projet : ${dossier}`, demande && `Dernière demande de l'utilisateur : ${demande}`,
    reponse && `Fin de la dernière réponse de Claude : ${reponse}`].filter(Boolean).join('\n')
}

// La liste est coupée à MAX_CAPACITES : celles dont le nom ou la description reprend des mots de la demande passent en tête.
export function promptPlume(brouillon: string, capacites: readonly Capacite[], contexte = '', blocs: readonly string[] = []): string {
  const mots = [...new Set(brouillon.toLowerCase().match(/[\p{L}\d]{5,}/gu) ?? [])]
  const pertinence = (c: Capacite) => { const t = `${c.nom} ${c.description}`.toLowerCase(); return mots.filter(m => t.includes(m)).length }
  const liste = capacites.map((c, i) => ({ c, s: pertinence(c), i })).sort((a, b) => b.s - a.s || a.i - b.i).slice(0, MAX_CAPACITES)
    .map(({ c }) => `- ${c.sorte} ${c.sorte === 'commande' ? '/' : ''}${c.nom} : ${c.description.replace(/\s+/g, ' ').slice(0, 140)}`)
    .join('\n')
  return `${contexte ? `Contexte récent de la conversation :\n${contexte}\n\n` : ''}Ce dont Claude dispose dans cette session :\n${liste}\n\n${aReecrire(brouillon, blocs)}`
}

// La réécriture est attendue entre <<< et >>> : ce qui les entoure (« Voici… ») est laissé. Ouverte sans être refermée,
// elle a été coupée en route : null, pour ne jamais remplacer ta demande par un morceau.
export function nettoyerReponse(texte: string): string | null {
  const t = texte.trim()
  const debut = t.indexOf('<<<')
  if (debut >= 0) {
    const fin = t.lastIndexOf('>>>')
    return fin > debut ? t.slice(debut + 3, fin).trim() : null
  }
  return t.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/, '').trim()
}

type Mot = { cle: string; start: number; end: number; ajoute: boolean }
type Passage = { start: number; end: number }

// Les mots de `apres`, chacun marqué ajouté ou non par rapport à `avant` (la plus longue suite de mots communs), sans tenir
// compte des majuscules ni de la ponctuation. Au-delà de 4 millions de comparaisons, null.
function comparer(avant: string, apres: string): Mot[] | null {
  const cle = (m: string) => m.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
  const a = (avant.match(/\S+/g) ?? []).map(cle)
  const b = [...apres.matchAll(/\S+/g)].map(m => ({ cle: cle(m[0]), start: m.index!, end: m.index! + m[0].length, ajoute: true }))
  if (a.length * b.length > 4_000_000) return null
  const L = Array.from({ length: a.length + 1 }, () => new Uint16Array(b.length + 1)) // L[i][j] : suite commune de a[i..] et b[j..]
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--)
    L[i]![j] = a[i] === b[j]!.cle ? L[i + 1]![j + 1]! + 1 : Math.max(L[i + 1]![j]!, L[i]![j + 1]!)
  for (let i = 0, j = 0; i < a.length && j < b.length;) {
    if (a[i] === b[j]!.cle) { b[j]!.ajoute = false; i++; j++ } else if (L[i + 1]![j]! >= L[i]![j + 1]!) i++; else j++
  }
  return b
}

// La ponctuation seule n'ouvre jamais un passage, mais prolonge celui qui est ouvert : « [à préciser : lequel ?] » d'un tenant.
function passages(mots: readonly Mot[]): Passage[] {
  const sortie: Passage[] = []
  let ouvert = false
  for (const m of mots) {
    if (!m.cle) { if (ouvert) sortie[sortie.length - 1]!.end = m.end; continue }
    if (!m.ajoute) { ouvert = false; continue }
    if (ouvert) sortie[sortie.length - 1]!.end = m.end
    else { sortie.push({ start: m.start, end: m.end }); ouvert = true }
  }
  return sortie
}

// Ce que la plume a ajouté : les passages de `apres` absents de `avant`.
export const ajouts = (avant: string, apres: string): Passage[] => passages(comparer(avant, apres) ?? [])

// Ce que la plume met en gras : ses ajouts. Quand plus de la moitié des mots sont nouveaux, ce gras se découpe en morceaux
// et ne se lit plus d'un coup d'œil (vu sur capture le 04/11/2026) : seuls les trous à remplir restent en gras.
export function gras(avant: string, apres: string): Passage[] {
  const mots = comparer(avant, apres)?.filter(m => m.cle)
  if (mots && mots.filter(m => m.ajoute).length * 2 <= mots.length) return ajouts(avant, apres)
  return [...apres.matchAll(/\[à préciser :[^\]]*\]/g)].map(m => ({ start: m.index!, end: m.index! + m[0].length }))
}

// Le message d'un appel à Claude resté sans réécriture, selon sa cause (`reason`, et `error` pour une erreur de l'API).
export function messageEchec(r: { reason: string; error?: string }): string {
  if (r.reason === 'aborted') return "Pupitre : amélioration interrompue, ton texte n'a pas bougé."
  if (r.reason === 'empty-reply') return "Pupitre : Claude n'a rien renvoyé, réessaie."
  if (r.error === 'rate_limit') return "Pupitre : limite d'utilisation atteinte, réessaie plus tard."
  if (r.error === 'overloaded') return 'Pupitre : Claude est surchargé, réessaie dans un instant.'
  if (r.error === 'authentication_failed') return 'Pupitre : la connexion à Claude a expiré, reconnecte-toi.'
  return 'Amélioration impossible : réessaie.'
}

// Une ligne qui ressemble à du code ou à un message d'erreur collé : en retrait, pauvre en lettres, ou une ligne d'erreur.
// shortcut: devinée ligne à ligne ; un collage sans retrait ni symbole passe dans la réécriture, comme avant.
const technique = (l: string) => {
  const t = l.trim()
  if (!t) return false
  if (/^(\s{2,}|\t)\S/.test(l) || /^(at |File "|Traceback\b|\w*(Error|Exception)\b)/.test(t)) return true
  return t.length >= 8 && (t.match(/[\p{L}\s]/gu)?.length ?? 0) / t.length < 0.7
}

// Met de côté les passages collés (blocs entre ```, suites de lignes techniques) derrière des repères ⟦1⟧, ⟦2⟧… :
// la réécriture ne peut pas les changer, `restaurer` les remet mot pour mot.
export function proteger(texte: string): { texte: string; blocs: string[] } {
  const blocs: string[] = []
  const repere = (bloc: string) => { blocs.push(bloc); return `⟦${blocs.length}⟧` }
  const lignes = texte.split('\n')
  const sortie: string[] = []
  for (let i = 0; i < lignes.length; i++) {
    const l = lignes[i]!
    if (l.trimStart().startsWith('```')) {
      const fin = lignes.findIndex((x, j) => j > i && x.trimStart().startsWith('```'))
      if (fin > i) { sortie.push(repere(lignes.slice(i, fin + 1).join('\n'))); i = fin; continue }
    }
    if (technique(l)) {
      let fin = i
      while (fin + 1 < lignes.length && technique(lignes[fin + 1]!)) fin++
      sortie.push(repere(lignes.slice(i, fin + 1).join('\n'))); i = fin; continue
    }
    sortie.push(l)
  }
  return blocs.length === 0 ? { texte, blocs } : { texte: sortie.join('\n'), blocs }
}

// Remet les passages collés à la place de leurs repères ; null si la réécriture en a perdu ou doublé un.
export function restaurer(texte: string, blocs: readonly string[]): string | null {
  for (let n = 1; n <= blocs.length; n++) if (texte.split(`⟦${n}⟧`).length !== 2) return null
  return texte.replace(/⟦(\d+)⟧/g, (r, n: string) => blocs[Number(n) - 1] ?? r)
}

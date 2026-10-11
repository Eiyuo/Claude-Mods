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
export const CONSIGNE_CAP_AUTO =
  "Mode cap du mod pupitre : quand tu as fini le travail demandé, et seulement à ce moment-là, termine ta réponse par " +
  "l'outil AskUserQuestion avec la question « Et maintenant, on fait quoi ? » et 3 suites possibles, concrètes et utiles " +
  "pour la suite du travail ; place ta recommandation en premier, avec « (Recommandé) » à la fin de son libellé. Ne la " +
  "pose pas si tu poses déjà une autre question ou si le travail n'est pas fini."

// relais.md reste sur l'ordinateur : publié avec le dépôt, il exposerait la conversation et les règles de l'utilisateur.
export function consigneRelais(sessionId: string): string {
  return "Passer le relais. Écris le fichier relais.md à la racine du projet ouvert (remplace-le s'il existe), en français, " +
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
  "« ce fichier »…, sans reprendre d'autres sujets ; si un point essentiel reste ambigu, ne devine pas : ajoute une phrase " +
  "qui demande à Claude de poser la question avant d'agir ; garde à peu près la même longueur (une demande de quelques mots " +
  "peut gagner 2 ou 3 phrases, pas plus) ; si un outil, une commande, un connecteur ou un sous-agent de la liste fournie sert " +
  "vraiment, cite-le par son nom exact (une commande s'écrit avec « / ») ; reste direct, en tutoyant ; réponds uniquement " +
  "par le texte réécrit, sans titre, sans guillemets, sans commentaire."

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
export function promptPlume(brouillon: string, capacites: readonly Capacite[], contexte = ''): string {
  const mots = [...new Set(brouillon.toLowerCase().match(/[\p{L}\d]{5,}/gu) ?? [])]
  const pertinence = (c: Capacite) => { const t = `${c.nom} ${c.description}`.toLowerCase(); return mots.filter(m => t.includes(m)).length }
  const liste = capacites.map((c, i) => ({ c, s: pertinence(c), i })).sort((a, b) => b.s - a.s || a.i - b.i).slice(0, MAX_CAPACITES)
    .map(({ c }) => `- ${c.sorte} ${c.sorte === 'commande' ? '/' : ''}${c.nom} : ${c.description.replace(/\s+/g, ' ').slice(0, 140)}`)
    .join('\n')
  return `${contexte ? `Contexte récent de la conversation :\n${contexte}\n\n` : ''}Ce dont Claude dispose dans cette session :\n${liste}\n\nDemande à réécrire :\n<<<\n${brouillon}\n>>>`
}

export function nettoyerReponse(texte: string): string {
  let t = texte.trim()
  t = t.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/, '')
  t = t.replace(/^<<<\n?/, '').replace(/\n?>>>$/, '')
  return t.trim()
}

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

export function consigneRelais(sessionId: string): string {
  return "Passer le relais. Écris le fichier relais.md à la racine du projet ouvert (remplace-le s'il existe), en français. " +
    `Première ligne : <!-- Conversation d'origine : claude --resume ${sessionId} -->. Deuxième ligne : « STATUT : À REPRENDRE », ` +
    "ou « STATUT : ATTENDRE » si la suite dépend d'une décision de l'utilisateur. Puis la date, et ces parties : Objectif ; " +
    "Contraintes permanentes (les règles à toujours respecter) ; Ce qui a été fait ; État actuel ; Décisions prises et " +
    "pourquoi ; Prochaines étapes (la première, précise) ; Blocages ; Fichiers clés. Écris-le pour qu'une conversation " +
    "neuve, qui n'a rien vu, puisse reprendre exactement là. N'y mets ni identifiant d'entreprise ni nom réel de " +
    "l'utilisateur. Puis, si le dossier est un dépôt git, enregistre-le : git add relais.md, puis git commit -m \"docs: relais\" ; " +
    "n'envoie rien sur le dépôt distant. Si ce n'est pas un dépôt git, dis-le. Réponds ensuite en une seule ligne."
}
export const REPRISE_RELAIS =
  "Lis relais.md à la racine du projet et résume-moi en 3 lignes où on en est. Si son STATUT est ATTENDRE, arrête-toi là " +
  "et attends ma décision ; sinon, reprends à « Prochaines étapes », sans refaire ce qui est déjà fait."

export function relaisEcrit(mtimeMs: number | null, debut: number): boolean {
  return mtimeMs !== null && mtimeMs >= debut
}

export type Capacite = { sorte: 'commande' | 'outil' | 'connecteur' | 'sous-agent'; nom: string; description: string }

export const SYSTEME_PLUME =
  "Tu réécris la demande qu'un utilisateur s'apprête à envoyer à Claude Code, pour qu'elle soit précise et complète. " +
  "Règles : garde sa langue et son intention ; n'invente aucun fait, aucun fichier, aucune contrainte ; rends explicites " +
  "le but, le contexte utile, les contraintes et le résultat attendu ; si un outil, une commande, un connecteur ou un " +
  "sous-agent de la liste fournie sert vraiment, cite-le par son nom exact (une commande s'écrit avec « / ») ; reste court " +
  "et direct, en tutoyant ; réponds uniquement par le texte réécrit, sans titre, sans guillemets, sans commentaire."

const MAX_CAPACITES = 150

export function promptPlume(brouillon: string, capacites: readonly Capacite[]): string {
  const liste = capacites.slice(0, MAX_CAPACITES)
    .map(c => `- ${c.sorte} ${c.sorte === 'commande' ? '/' : ''}${c.nom} : ${c.description.replace(/\s+/g, ' ').slice(0, 140)}`)
    .join('\n')
  return `Ce dont Claude dispose dans cette session :\n${liste}\n\nDemande à réécrire :\n<<<\n${brouillon}\n>>>`
}

export function nettoyerReponse(texte: string): string {
  let t = texte.trim()
  t = t.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/, '')
  t = t.replace(/^<<<\n?/, '').replace(/\n?>>>$/, '')
  return t.trim()
}

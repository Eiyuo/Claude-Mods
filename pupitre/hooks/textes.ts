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

export const DEMANDE_CAP = 'Fixe le cap : pose-moi tes questions sur la suite.'
export const CONSIGNE_CAP =
  "L'utilisateur a tapé /cap : il veut fixer le cap. Relis la conversation, puis pose-lui de 1 à 4 questions avec l'outil " +
  "AskUserQuestion : prochaine étape, priorité, ce qu'on laisse de côté, et toute autre décision encore ouverte. Chaque " +
  "question a des options concrètes ; place ta recommandation en premier, avec « (Recommandé) » à la fin de son libellé. " +
  "Ensuite, reprends le travail sur le cap choisi, sans redemander."

export const DEMANDE_RELAIS = 'Passer le relais : écris relais.md.'
export const CONSIGNE_RELAIS =
  "Passer le relais. Écris le fichier relais.md à la racine du projet ouvert (remplace-le s'il existe), en français, " +
  "avec ces parties : la date ; où on en est ; ce qui a été fait ; ce qui reste à faire ; les décisions prises et pourquoi ; " +
  "les contraintes et règles à respecter ; les blocages et problèmes ; les fichiers clés ; la prochaine action précise. " +
  "Écris-le pour qu'une conversation neuve, qui n'a rien vu, puisse reprendre exactement là. N'y mets ni identifiant " +
  "d'entreprise ni nom réel de l'utilisateur. Puis, si le dossier est un dépôt git, enregistre-le : git add relais.md, " +
  "puis git commit -m \"docs: relais\" ; n'envoie rien sur le dépôt distant. Si ce n'est pas un dépôt git, dis-le. " +
  "Réponds ensuite en une seule ligne."
export const REPRISE_RELAIS =
  "Lis relais.md à la racine du projet et reprends là où on s'est arrêtés. Commence par me résumer en 3 lignes où on en est."

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

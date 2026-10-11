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

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

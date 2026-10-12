import type { LigneFil } from '../types'
import { niveauDe } from './pixels'

export type StatutTache = 'pending' | 'in_progress' | 'completed'
export type Tache = { id: string; sujet: string; statut: StatutTache }
// attente : Claude t'a posé une question (AskUserQuestion) et attend ta réponse ; de l'appel jusqu'à son résultat.
export type Suivi = { taches: Tache[]; mot: string; debut: number; fin: number | null; crees: number; attente: boolean }
export type Vue = { tache: string; compteur: string; progression: number; faites: number; total: number; estime: boolean }

const MOTS: Record<string, string> = {
  Read: 'Lecture', NotebookRead: 'Lecture',
  Grep: 'Recherche', Glob: 'Recherche', ToolSearch: 'Recherche',
  Edit: 'Écriture', Write: 'Écriture', NotebookEdit: 'Écriture',
  Bash: 'Commande', PowerShell: 'Commande',
  Agent: 'Délégation', Workflow: 'Délégation', SendMessage: 'Délégation',
  WebFetch: 'Web', WebSearch: 'Web',
  AskUserQuestion: 'Question',
  Skill: 'Méthode',
  TaskCreate: 'Organisation', TaskUpdate: 'Organisation', TodoWrite: 'Organisation',
}

export function motEtape(outil: string): string {
  const m = MOTS[outil]
  if (m) return m
  if (outil.startsWith('mcp__Claude_Browser') || outil.startsWith('mcp__claude-in-chrome')) return 'Web'
  if (outil.startsWith('mcp__')) return 'Connecteur'
  return 'Action'
}

export function nouveauSuivi(debut: number): Suivi {
  return { taches: [], mot: 'Réflexion', debut, fin: null, crees: 0, attente: false }
}

export function debutTour(s: Suivi, maintenant: number): Suivi {
  const enCours = s.taches.some(t => t.statut !== 'completed')
  return { taches: enCours ? s.taches : [], mot: 'Réflexion', debut: maintenant, fin: null, crees: enCours ? s.crees : 0, attente: false }
}

function objet(v: unknown): Record<string, unknown> {
  return typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {}
}
function statut(v: unknown): StatutTache | null {
  return v === 'pending' || v === 'in_progress' || v === 'completed' ? v : null
}

export function appliquerAppel(s: Suivi, outil: string, entree: unknown, resultat: unknown): Suivi {
  const e = objet(entree)
  let { taches, crees } = s
  if (outil === 'TaskCreate') {
    crees += 1
    const tache = objet(objet(resultat).task)
    const id = typeof tache.id === 'string' ? tache.id : String(crees)
    const sujet = typeof e.subject === 'string' ? e.subject : typeof tache.subject === 'string' ? tache.subject : `Tâche ${crees}`
    taches = [...taches, { id, sujet, statut: 'pending' }]
  } else if (outil === 'TaskUpdate' && typeof e.taskId === 'string') {
    if (e.status === 'deleted') taches = taches.filter(t => t.id !== e.taskId)
    else taches = taches.map(t => t.id !== e.taskId ? t : {
      ...t,
      statut: statut(e.status) ?? t.statut,
      sujet: typeof e.subject === 'string' ? e.subject : t.sujet,
    })
  } else if (outil === 'TodoWrite' && Array.isArray(e.todos)) {
    taches = e.todos.map((t, i) => {
      const o = objet(t)
      return { id: String(i + 1), sujet: typeof o.content === 'string' ? o.content : `Tâche ${i + 1}`, statut: statut(o.status) ?? 'pending' }
    })
    crees = taches.length
  }
  return { ...s, taches, crees, mot: motEtape(outil), attente: false } // l'outil a rendu son résultat : plus d'attente
}

export function etape(s: Suivi, outil: string): Suivi {
  return { ...s, mot: motEtape(outil), attente: outil === 'AskUserQuestion' }
}

export function finir(s: Suivi, maintenant: number): Suivi {
  return { ...s, fin: maintenant, mot: '✓ Fini' }
}

export function estimation(ms: number): number {
  return 0.9 * (1 - Math.exp(-Math.max(0, ms) / 40_000))
}

export function vue(s: Suivi, maintenant: number): Vue {
  const total = s.taches.length
  const faites = s.taches.filter(t => t.statut === 'completed').length
  if (s.fin !== null) {
    return {
      tache: total > 0 ? `Terminé · ${total} tâche${total > 1 ? 's' : ''}` : 'Terminé',
      compteur: total > 0 ? `${total} / ${total}` : '✓',
      progression: 1, faites: total, total, estime: false,
    }
  }
  if (total > 0) {
    const i = s.taches.findIndex(t => t.statut === 'in_progress')
    const j = i >= 0 ? i : s.taches.findIndex(t => t.statut === 'pending')
    return {
      tache: j >= 0 ? `Tâche ${j + 1} · ${s.taches[j]!.sujet}` : 'Tâches faites',
      compteur: `${faites} / ${total}`,
      progression: faites / total, faites, total, estime: false,
    }
  }
  const p = Math.floor(estimation(maintenant - s.debut) * 20) / 20
  return { tache: 'En cours', compteur: '≈', progression: p, faites: 0, total: 0, estime: true }
}

export function ligneDe(id: string, qui: string, s: Suivi, maintenant: number, p: LigneFil | undefined): LigneFil {
  const v = vue(s, maintenant)
  const fini = s.fin !== null
  const niveau = niveauDe(v.progression, fini)
  const changeProg = !p || p.progression !== v.progression
  const changeNiv = !p || p.niveau !== niveau
  const attente = !fini && s.attente
  const change = changeProg || changeNiv || !p || p.mot !== s.mot || p.tache !== v.tache || p.compteur !== v.compteur || p.fini !== fini || p.attente !== attente
  return {
    id, qui, tache: v.tache, mot: s.mot, compteur: v.compteur,
    progression: v.progression,
    avant: !p ? 0 : changeProg ? p.progression : v.progression,
    niveau,
    niveauAvant: !p ? niveau : changeNiv ? p.niveau : niveau,
    fini,
    eclat: fini && !(p?.fini ?? false),
    attente,
    debut: s.debut,
    majLe: change ? maintenant : p!.majLe,
    finiLe: fini ? (p?.finiLe ?? maintenant) : null,
  }
}

// Après un rechargement du mod (suivis repart à vide) : les barres finies restent affichées avec leur croix,
// les barres en cours, qu'on ne peut plus suivre, partent.
export function lignesGardees(lignes: readonly LigneFil[]): LigneFil[] {
  return lignes.filter(l => l.fini)
}

export const DUREE_FINIE_MS = 5_000 // une barre finie s'efface 5 s après être passée au vert (demande du 12/10/2026)

export function encoreVisible(finiLe: number | null, maintenant: number): boolean {
  return finiLe === null || maintenant - finiLe < DUREE_FINIE_MS
}

import type { Autre, LigneFil, Niveau } from '../types'

export const PERIME_MS = 15_000

export type Fiche = {
  id: string; titre: string; tache: string; compteur: string; progression: number
  niveau: Niveau; debut: number; majLe: number; actif: boolean; finiLe: number | null
  demande: string; mot: string // titre de la ligne (le début de la demande) et mot d'étape
}

export function ficheDe(id: string, titre: string, l: LigneFil | undefined, maintenant: number): Fiche {
  return {
    id, titre,
    tache: l?.tache ?? '', compteur: l?.compteur ?? '', progression: l?.progression ?? 0,
    niveau: l?.niveau ?? 0, debut: l?.debut ?? maintenant, majLe: maintenant,
    actif: l !== undefined && !l.fini, finiLe: l?.finiLe ?? null, demande: l?.qui ?? '', mot: l?.mot ?? '',
  }
}

export function lireFiche(texte: string): Fiche | null {
  let v: unknown
  try { v = JSON.parse(texte) } catch { return null }
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return null
  const o = v as Record<string, unknown>
  const s = (k: string) => typeof o[k] === 'string'
  const n = (k: string) => typeof o[k] === 'number' && Number.isFinite(o[k])
  if (!s('id') || !s('titre') || !s('tache') || !s('compteur') || !n('progression') || !n('debut') || !n('majLe') || typeof o.actif !== 'boolean') return null
  const niveau: Niveau = o.niveau === 0 || o.niveau === 1 || o.niveau === 2 || o.niveau === 3 ? o.niveau : 0
  return {
    id: o.id as string, titre: o.titre as string, tache: o.tache as string, compteur: o.compteur as string,
    progression: o.progression as number, niveau, debut: o.debut as number, majLe: o.majLe as number, actif: o.actif as boolean,
    finiLe: n('finiLe') ? o.finiLe as number : null, // ces trois-là manquent aux fiches d'une version précédente
    demande: s('demande') ? o.demande as string : '', mot: s('mot') ? o.mot as string : '',
  }
}

// Une discussion en cours vient de sa fiche. Vue en cours puis finie, sa ligne reste jusqu'à sa croix, même quand
// sa fiche périme ou que la discussion se ferme. Fermée par sa croix, elle ne revient qu'à la demande suivante.
export function suivreAutres(avant: readonly Autre[], fiches: readonly (Fiche | null)[], moi: string, maintenant: number): Autre[] {
  const vues = new Set(avant.map(a => a.id))
  const fraiches = fiches.filter((f): f is Fiche => f !== null && f.id !== moi && maintenant - f.majLe <= PERIME_MS && (f.actif || (f.finiLe !== null && vues.has(f.id))))
  const ids = new Set(fraiches.map(f => f.id))
  return [
    ...fraiches.map(f => ({ id: f.id, titre: f.titre, tache: f.tache, compteur: f.compteur, progression: f.progression, niveau: f.niveau, debut: f.debut, majLe: f.majLe, finiLe: f.finiLe, demande: f.demande, mot: f.mot })),
    ...avant.filter(a => a.finiLe !== null && !ids.has(a.id)),
  ].sort((a, b) => a.debut - b.debut)
}

export function nomFichier(id: string): string {
  return id.replace(/[^A-Za-z0-9_-]/g, '_') + '.json'
}

export function titreDe(cwd: string): string {
  const parts = cwd.split(/[\\/]/).filter(p => p.length > 0)
  return parts[parts.length - 1] ?? 'Session'
}

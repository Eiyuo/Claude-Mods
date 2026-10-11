import type { ReglageRelais, Reglages } from '../types'

export type Commande = 'pupitre' | 'jauge' | 'fil' | 'relais' | 'plume' | 'cap'
export const COMMANDES: readonly Commande[] = ['pupitre', 'jauge', 'fil', 'relais', 'plume', 'cap']

export const AUCUN: Reglages = { jauge: false, fil: false, cap: false, relais: false, plume: false }
const TOUT: Reglages = { jauge: true, fil: true, cap: true, relais: true, plume: true }

// nom affiché, accord « allumé », accord « éteint »
const NOMS: Record<Exclude<Commande, 'pupitre'>, readonly [string, string, string]> = {
  jauge: ['jauge', 'allumée', 'éteinte'],
  fil: ['fil', 'allumé', 'éteint'],
  relais: ['bouton « Passer le relais »', 'allumé', 'éteint'],
  plume: ['bouton « Améliorer le prompt »', 'allumé', 'éteint'],
  cap: ['cap automatique', 'allumé', 'éteint'],
}

export function lireReglages(v: unknown): Reglages {
  if (v === undefined) return { ...TOUT } // jamais réglé (première installation) : tout allumé, sans taper /pupitre
  const o = (typeof v === 'object' && v !== null ? v : {}) as Record<string, unknown>
  return { jauge: o.jauge === true, fil: o.fil === true, cap: o.cap === true, relais: o.relais === true, plume: o.plume === true }
}

export function toutAllume(r: Reglages): boolean {
  return r.jauge && r.fil && r.cap && r.relais && r.plume
}

export function basculer(r: Reglages, c: Commande): { reglages: Reglages; message: string } {
  if (c === 'pupitre') {
    return toutAllume(r)
      ? { reglages: { ...AUCUN }, message: 'Pupitre : tout est éteint' }
      : { reglages: { ...TOUT }, message: 'Pupitre : tout est allumé' }
  }
  const allume = !r[c]
  const [nom, oui, non] = NOMS[c]
  return { reglages: { ...r, [c]: allume }, message: `Pupitre : ${nom} ${allume ? oui : non}` }
}

// La ligne du bas porte la jauge, les boutons et « Réglages » : elle reste là tant qu'une fonction est allumée.
export function jaugeVisible(r: Reglages): boolean {
  return r.jauge || r.fil || r.relais || r.plume || r.cap
}

export function lireRelais(v: unknown): ReglageRelais {
  const o = (typeof v === 'object' && v !== null ? v : {}) as Record<string, unknown>
  const seuil = typeof o.seuil === 'number' && Number.isFinite(o.seuil) ? o.seuil : 60
  return { seuil: changerSeuil(Math.round(seuil / 5) * 5, 0), auto: o.auto === true }
}

// Le seuil du relais bouge de 5 en 5, entre 30 et 90 %.
export function changerSeuil(seuil: number, sens: -1 | 0 | 1): number {
  return Math.min(90, Math.max(30, seuil + 5 * sens))
}

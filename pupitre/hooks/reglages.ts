import type { Reglages } from '../types'

export type Commande = 'pupitre' | 'jauge' | 'fil' | 'relais' | 'plume'
export const COMMANDES: readonly Commande[] = ['pupitre', 'jauge', 'fil', 'relais', 'plume']

export const AUCUN: Reglages = { jauge: false, fil: false, cap: false, relais: false, plume: false }
const TOUT: Reglages = { jauge: true, fil: true, cap: true, relais: true, plume: true }

// nom affiché, accord « allumé », accord « éteint »
const NOMS: Record<Exclude<Commande, 'pupitre'>, readonly [string, string, string]> = {
  jauge: ['jauge', 'allumée', 'éteinte'],
  fil: ['fil', 'allumé', 'éteint'],
  relais: ['bouton « Passer le relais »', 'allumé', 'éteint'],
  plume: ['bouton « Améliorer le prompt »', 'allumé', 'éteint'],
}

export function lireReglages(v: unknown): Reglages {
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

export function jaugeVisible(r: Reglages): boolean {
  return r.jauge || r.relais || r.plume
}

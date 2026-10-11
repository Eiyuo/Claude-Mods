export type Reglages = { jauge: boolean; fil: boolean; cap: boolean; relais: boolean; plume: boolean }
export type Mesure = { pct: number | null; detail: string; court: string }
export type Mesures = { contexte: Mesure; cinqH: Mesure; septJ: Mesure }
export type Niveau = 0 | 1 | 2 | 3
export type LigneFil = {
  id: string; qui: string; tache: string; mot: string; compteur: string
  progression: number; avant: number; niveau: Niveau; niveauAvant: Niveau
  fini: boolean; eclat: boolean; debut: number; majLe: number; finiLe: number | null
}
export type Plume = { original: string | null; jusqua: number; enCours: boolean }
export type Autre = { id: string; titre: string; tache: string; compteur: string; progression: number; niveau: Niveau; debut: number; majLe: number }

declare module 'claude-code' {
  interface PluginState {
    pupitre: {
      reglages: Reglages
      mesures: Mesures
      lignes: LigneFil[]
      autres: Autre[]
      maintenant: number
      plume: Plume
      reglagesOuverts: boolean
    }
  }
}

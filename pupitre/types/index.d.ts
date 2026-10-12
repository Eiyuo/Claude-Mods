export type Reglages = { jauge: boolean; fil: boolean; cap: boolean; relais: boolean; plume: boolean }
export type Mesure = { pct: number | null; detail: string; court: string }
export type Mesures = { contexte: Mesure; cinqH: Mesure; septJ: Mesure }
export type Niveau = 0 | 1 | 2 | 3 | 4 | 5 | 6 // six étapes de couleur (Spectre), puis 6 : fini
export type LigneFil = {
  id: string; qui: string; tache: string; mot: string; compteur: string
  progression: number; avant: number; niveau: Niveau; niveauAvant: Niveau
  fini: boolean; eclat: boolean; debut: number; majLe: number; finiLe: number | null
  attente: boolean // Claude t'a posé une question et attend ta réponse
}
export type ReglageRelais = { seuil: number; auto: boolean } // seuil du contexte, en %, de 30 à 90
export type Animations = 'completes' | 'reduites' | 'coupees' // réduites : sans boucles ; coupées : images fixes
export type Plume = { original: string | null; enCours: boolean } // original : ton texte d'avant, jusqu'à l'envoi
export type Pied = { effacer: boolean; relais: number | null } // ligne des boutons du bureau : « Effacer » à montrer ? contexte sur « Passer le relais »
export type Autre = { id: string; titre: string; tache: string; compteur: string; progression: number; niveau: Niveau; debut: number; majLe: number; finiLe: number | null; demande: string; mot: string; attente: boolean }

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
      charge: boolean
      relais: ReglageRelais
      cache: number | null
      animations: Animations
      pied: Pied
    }
  }
}

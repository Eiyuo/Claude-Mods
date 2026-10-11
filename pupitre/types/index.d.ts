export type Reglages = { jauge: boolean; fil: boolean; cap: boolean; relais: boolean; plume: boolean }
export type Mesure = { pct: number | null; detail: string }
export type Mesures = { contexte: Mesure; cinqH: Mesure; septJ: Mesure }

declare module 'claude-code' {
  interface PluginState {
    pupitre: {
      reglages: Reglages
      mesures: Mesures
    }
  }
}

export type Reglages = { jauge: boolean; fil: boolean; cap: boolean; relais: boolean; plume: boolean }

declare module 'claude-code' {
  interface PluginState {
    pupitre: {
      reglages: Reglages
    }
  }
}

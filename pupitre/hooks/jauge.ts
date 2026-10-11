import type { Mesure, Mesures } from '../types'

export const TIRET = '—'
export const MESURES_VIDES: Mesures = {
  contexte: { pct: null, detail: TIRET, court: '' },
  cinqH: { pct: null, detail: TIRET, court: '' },
  septJ: { pct: null, detail: TIRET, court: '' },
}

export function kilo(n: number): string {
  if (n < 1000) return String(Math.round(n))
  if (n < 1_000_000) return `${Math.round(n / 1000)} k`
  return `${(n / 1_000_000).toFixed(1).replace('.', ',')} M`
}

export function dureeAvant(resetsAt: string | undefined, maintenant: number): string {
  if (!resetsAt) return ''
  const t = Date.parse(resetsAt)
  if (Number.isNaN(t)) return ''
  const min = Math.floor((t - maintenant) / 60000)
  if (min <= 0) return 'remise à zéro imminente'
  if (min < 60) return `remise à zéro dans ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `remise à zéro dans ${h} h ${String(min % 60).padStart(2, '0')}`
  return `remise à zéro dans ${Math.floor(h / 24)} j ${h % 24} h`
}

// Forme courte pour la ligne unique de la jauge : « ↻ 1 h 52 » ; la phrase entière va dans l'info-bulle.
export function dureeCourte(resetsAt: string | undefined, maintenant: number): string {
  const d = dureeAvant(resetsAt, maintenant)
  if (!d) return ''
  return d === 'remise à zéro imminente' ? '↻ imminente' : `↻ ${d.replace('remise à zéro dans ', '')}`
}

// Part de la dernière demande servie par le cache d'Anthropic (moins chère et plus rapide) ; null sans demande.
export function pourcentageCache(u: { input_tokens: number; cache_read_input_tokens: number; cache_creation_input_tokens: number } | undefined): number | null {
  const total = u ? u.input_tokens + u.cache_read_input_tokens + u.cache_creation_input_tokens : 0
  return u && total > 0 ? Math.round(u.cache_read_input_tokens / total * 100) : null
}

export function formatPct(pct: number | null): string {
  return pct === null ? TIRET : `${Math.round(pct)} %`
}

export type UsageLu = {
  context: { tokens?: number; window: number; percent?: number }
  rateLimits: readonly { kind: string; percentUsed: number; resetsAt?: string }[]
}

function limite(u: UsageLu, kind: string, maintenant: number): Mesure {
  const l = u.rateLimits.find(r => r.kind === kind)
  if (!l) return { pct: null, detail: TIRET, court: '' }
  return { pct: l.percentUsed, detail: dureeAvant(l.resetsAt, maintenant) || TIRET, court: dureeCourte(l.resetsAt, maintenant) }
}

export function lireMesures(u: UsageLu, maintenant: number): Mesures {
  const c = u.context
  const brut = c.percent ?? (c.tokens !== undefined && c.window > 0 ? (c.tokens / c.window) * 100 : null)
  const pct = brut === null ? null : Math.round(brut * 10) / 10 // 42, pas 41.99999999999999
  const detail = c.tokens !== undefined ? `${kilo(c.tokens)} / ${kilo(c.window)} jetons` : `fenêtre de ${kilo(c.window)} jetons`
  return {
    contexte: { pct, detail, court: '' },
    cinqH: limite(u, 'five_hour', maintenant),
    septJ: limite(u, 'seven_day', maintenant),
  }
}

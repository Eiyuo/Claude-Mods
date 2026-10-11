import { describe, expect, test } from 'claude-code/testing'
import { MESURES_VIDES, dureeAvant, dureeCourte, formatPct, kilo, lireMesures } from '../hooks/jauge'

const T0 = Date.parse('2026-10-11T10:00:00Z')

describe('jauge', () => {
  test('kilo', async () => {
    expect(kilo(950)).toBe('950')
    expect(kilo(84321)).toBe('84 k')
    expect(kilo(1_000_000)).toBe('1,0 M')
  })
  test('compte à rebours', async () => {
    expect(dureeAvant(undefined, T0)).toBe('')
    expect(dureeAvant('pas une date', T0)).toBe('')
    expect(dureeAvant('2026-10-11T09:00:00Z', T0)).toBe('remise à zéro imminente')
    expect(dureeAvant('2026-10-11T10:38:30Z', T0)).toBe('remise à zéro dans 38 min')
    expect(dureeAvant('2026-10-11T11:52:00Z', T0)).toBe('remise à zéro dans 1 h 52')
    expect(dureeAvant('2026-10-11T11:05:00Z', T0)).toBe('remise à zéro dans 1 h 05')
    expect(dureeAvant('2026-10-14T14:00:00Z', T0)).toBe('remise à zéro dans 3 j 4 h')
  })
  test('compte à rebours court, pour la ligne unique', async () => {
    expect(dureeCourte(undefined, T0)).toBe('')
    expect(dureeCourte('2026-10-11T09:00:00Z', T0)).toBe('↻ imminente')
    expect(dureeCourte('2026-10-11T10:38:30Z', T0)).toBe('↻ 38 min')
    expect(dureeCourte('2026-10-11T11:52:00Z', T0)).toBe('↻ 1 h 52')
    expect(dureeCourte('2026-10-14T14:00:00Z', T0)).toBe('↻ 3 j 4 h')
  })
  test('pourcentage', async () => {
    expect(formatPct(null)).toBe('—')
    expect(formatPct(42.4)).toBe('42 %')
  })
  test('sans abonnement : limites en tiret, contexte calculé', async () => {
    const m = lireMesures({ context: { tokens: 84000, window: 200000 }, rateLimits: [] }, T0)
    expect(m.contexte.pct).toBe(42)
    expect(m.contexte.detail).toBe('84 k / 200 k jetons')
    expect(m.cinqH).toEqual(MESURES_VIDES.cinqH)
    expect(m.septJ).toEqual(MESURES_VIDES.septJ)
  })
  test('avec abonnement', async () => {
    const m = lireMesures({
      context: { window: 200000, percent: 12.5 },
      rateLimits: [
        { kind: 'five_hour', percentUsed: 78, resetsAt: '2026-10-11T11:52:00Z' },
        { kind: 'seven_day', percentUsed: 93.4, resetsAt: '2026-10-14T14:00:00Z' },
        { kind: 'spend_limit', percentUsed: 5 },
      ],
    }, T0)
    expect(m.contexte.pct).toBe(12.5)
    expect(m.contexte.detail).toBe('fenêtre de 200 k jetons')
    expect(m.cinqH).toEqual({ pct: 78, detail: 'remise à zéro dans 1 h 52', court: '↻ 1 h 52' })
    expect(m.septJ).toEqual({ pct: 93.4, detail: 'remise à zéro dans 3 j 4 h', court: '↻ 3 j 4 h' })
    expect(m.contexte.court).toBe('')
  })
})

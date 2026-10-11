import { describe, expect, test } from 'claude-code/testing'
import { CONSIGNE_CAP, CONSIGNE_FIL, CONSIGNE_RELAIS, DEMANDE_CAP, REPRISE_RELAIS, chrono, relaisEcrit } from '../hooks/textes'

describe('textes', () => {
  test('la consigne /fil demande une liste de tâches à Claude et aux sous-agents', async () => {
    expect(CONSIGNE_FIL).toContain('TaskCreate')
    expect(CONSIGNE_FIL).toContain('sous-agent')
  })
  test('chrono', async () => {
    expect(chrono(0)).toBe('0:00')
    expect(chrono(65_000)).toBe('1:05')
    expect(chrono(3_725_000)).toBe('1:02:05')
    expect(chrono(-5)).toBe('0:00')
  })
})

test('/cap : consigne et demande', async () => {
  expect(CONSIGNE_CAP).toContain('AskUserQuestion')
  expect(CONSIGNE_CAP).toContain('1 à 4')
  expect(CONSIGNE_CAP).toContain('(Recommandé)')
  expect(DEMANDE_CAP.length).toBeGreaterThan(0)
})

test('/relais : consigne complète, sans identité, sans push', async () => {
  for (const mot of ['relais.md', 'où on en est', 'ce qui a été fait', 'ce qui reste à faire', 'décisions', 'contraintes', 'blocages', 'fichiers clés', 'prochaine action', 'git commit']) {
    expect(CONSIGNE_RELAIS).toContain(mot)
  }
  expect(CONSIGNE_RELAIS).toContain("n'envoie rien")
  expect(REPRISE_RELAIS).toContain('relais.md')
})
test('/relais : la conversation n est vidée que si relais.md a été écrit pendant le relais', async () => {
  expect(relaisEcrit(null, 1000)).toBe(false)
  expect(relaisEcrit(999, 1000)).toBe(false)
  expect(relaisEcrit(1000, 1000)).toBe(true)
  expect(relaisEcrit(5000, 1000)).toBe(true)
})

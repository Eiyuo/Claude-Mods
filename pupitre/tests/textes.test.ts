import { describe, expect, test } from 'claude-code/testing'
import { CONSIGNE_FIL, chrono } from '../hooks/textes'

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

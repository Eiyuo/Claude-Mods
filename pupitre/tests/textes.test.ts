import { describe, expect, test } from 'claude-code/testing'
import { CONSIGNE_CAP_AUTO, CONSIGNE_FIL, REPRISE_RELAIS, consigneRelais, SYSTEME_PLUME, chrono, nettoyerReponse, promptPlume, relaisEcrit } from '../hooks/textes'

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

test('/cap automatique : Claude finit par la question « Et maintenant ? » et 3 suites', async () => {
  for (const mot of ['AskUserQuestion', 'Et maintenant, on fait quoi ?', '3 suites', '(Recommandé)']) expect(CONSIGNE_CAP_AUTO).toContain(mot)
})

test('/relais : consigne complète, avec la conversation d origine, sans identité, sans push', async () => {
  const c = consigneRelais('abc-123')
  for (const mot of ['relais.md', 'claude --resume abc-123', 'STATUT', 'Objectif', 'Contraintes permanentes', 'Ce qui a été fait', 'État actuel', 'Décisions', 'Prochaines étapes', 'Blocages', 'Fichiers clés', 'git commit']) {
    expect(c).toContain(mot)
  }
  expect(c).toContain("n'envoie rien")
  for (const mot of ['relais.md', 'STATUT', 'ATTENDRE', 'Prochaines étapes']) expect(REPRISE_RELAIS).toContain(mot)
})
test('/relais : la conversation n est vidée que si relais.md a été écrit pendant le relais', async () => {
  expect(relaisEcrit(null, 1000)).toBe(false)
  expect(relaisEcrit(999, 1000)).toBe(false)
  expect(relaisEcrit(1000, 1000)).toBe(true)
  expect(relaisEcrit(5000, 1000)).toBe(true)
})

test('/plume : prompt avec la demande et les capacités, bornées', async () => {
  const caps = Array.from({ length: 400 }, (_, i) => ({ sorte: 'commande' as const, nom: `c${i}`, description: 'x'.repeat(500) }))
  const p = promptPlume('refais la page', caps)
  expect(p).toContain('refais la page')
  expect(p).toContain('c0')
  expect(p).not.toContain('c399')
  expect(p.length).toBeLessThan(60_000)
  expect(SYSTEME_PLUME).toContain("n'invente")
})
test('/plume : réponse nettoyée', async () => {
  expect(nettoyerReponse('  <<<\nTexte amélioré\n>>>  ')).toBe('Texte amélioré')
  expect(nettoyerReponse('```\nTexte\n```')).toBe('Texte')
  expect(nettoyerReponse('Texte simple')).toBe('Texte simple')
})

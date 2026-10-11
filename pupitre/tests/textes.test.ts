import { describe, expect, test } from 'claude-code/testing'
import { CONSIGNE_CAP_AUTO, CONSIGNE_FIL, REPRISE_RELAIS, consigneRelais, SYSTEME_PLUME, chrono, contexteRecent, messageHumain, nettoyerReponse, promptPlume, relaisEcrit } from '../hooks/textes'

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

test('/relais : consigne complète et vérifiée, sans identité ni chemin personnel, jamais dans git', async () => {
  const c = consigneRelais('abc-123')
  for (const mot of ['relais.md', 'claude --resume abc-123', 'STATUT', 'Objectif', 'Contraintes permanentes', 'Dernière demande', 'mot pour mot',
    'Ce qui a été fait', 'État actuel', 'git status', 'Comment vérifier', 'Décisions', 'Pistes écartées', 'Prochaines étapes', 'question exacte',
    'Blocages', 'Fichiers clés', '80 lignes', 'dossier personnel', '.git/info/exclude']) {
    expect(c).toContain(mot)
  }
  expect(c).not.toContain('git add')
  expect(c).not.toContain('git commit')
  expect(c).toContain("n'envoie rien")
  for (const mot of ['relais.md', 'STATUT', 'ATTENDRE', 'question', 'Prochaines étapes', 'git status', 'Pistes écartées']) expect(REPRISE_RELAIS).toContain(mot)
})
test('/cap : la consigne part avec tes messages, pas avec les messages automatiques (tâches de fond, /loop, autres sessions)', async () => {
  for (const k of ['composer', 'bridge', 'sdk', 'unclassified', 'plugin', 'slack-ping', 'auto-continuation']) expect(messageHumain(k)).toBe(true)
  for (const k of ['task-notification', 'scheduled-trigger', 'peer', 'peer-send-message', 'projects-relay', 'coordinator', 'observer', 'observer-activity', 'channel']) {
    expect(messageHumain(k)).toBe(false)
  }
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
test('/plume : les outils utiles à la demande passent en tête, même listés en dernier, et le contexte est joint', async () => {
  const caps = [...Array.from({ length: 400 }, (_, i) => ({ sorte: 'commande' as const, nom: `c${i}`, description: 'x' })),
    { sorte: 'sous-agent' as const, nom: 'revue-animations', description: 'Revue des animations CSS' }]
  const p = promptPlume('améliore les animations des barres', caps, 'Dernière réponse de Claude : voici les barres')
  expect(p).toContain('revue-animations')
  expect(p).toContain('voici les barres')
  for (const r of ['mot pour mot', 'contexte récent', 'même longueur']) expect(SYSTEME_PLUME).toContain(r)
})
test('/plume : contexte = dossier, dernière demande et fin de la dernière réponse, sans les ajouts techniques', async () => {
  const msgs = [
    { role: 'user', text: 'ancienne demande' },
    { role: 'assistant', text: 'ancienne réponse' },
    { role: 'user', text: 'refais les barres<system-reminder>consigne du cap</system-reminder>' },
    { role: 'assistant', text: '' },
    { role: 'user', text: '' },
    { role: 'assistant', text: 'x'.repeat(3000) + ' FIN' },
  ]
  const c = contexteRecent(msgs, 'Atelier')
  for (const m of ['Atelier', 'refais les barres', 'FIN']) expect(c).toContain(m)
  for (const m of ['system-reminder', 'consigne du cap', 'ancienne']) expect(c).not.toContain(m)
  expect(c.length).toBeLessThan(2500)
  expect(contexteRecent([], 'Atelier')).toContain('Atelier')
})
test('/plume : réponse nettoyée', async () => {
  expect(nettoyerReponse('  <<<\nTexte amélioré\n>>>  ')).toBe('Texte amélioré')
  expect(nettoyerReponse('```\nTexte\n```')).toBe('Texte')
  expect(nettoyerReponse('Texte simple')).toBe('Texte simple')
})

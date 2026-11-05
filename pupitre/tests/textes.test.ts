import { describe, expect, test } from 'claude-code/testing'
import { ajouts, CONSIGNE_CAP_AUTO, CONSIGNE_FIL, REPRISE_RELAIS, consigneRelais, SYSTEME_PLUME, chrono, contexteRecent, gras, messageHumain, nettoyerReponse, promptFork, promptPlume, proteger, relaisEcrit, restaurer } from '../hooks/textes'

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
  for (const mot of ['AskUserQuestion', 'Et maintenant ?', '3 suites', '(Recommandé)']) expect(CONSIGNE_CAP_AUTO).toContain(mot)
})
test('/cap : la question dit où on en est, et les 3 suites couvrent la suite directe, une vérification et une autre direction', async () => {
  // vu dans la session du 04/11/2026 : trois suites dans le prolongement, la même suite reproposée, une réponse tapée à la main
  for (const mot of ['où on en est', 'suite directe', 'vérification', 'autre direction']) expect(CONSIGNE_CAP_AUTO).toContain(mot)
  expect(CONSIGNE_CAP_AUTO).not.toContain('on fait quoi')
})
test('/cap : une suite proposée mais pas choisie peut revenir, jamais en premier deux fois de suite (choix du 05/11/2026)', async () => {
  for (const mot of ['pas choisie', 'jamais en premier deux fois de suite']) expect(CONSIGNE_CAP_AUTO).toContain(mot)
  expect(CONSIGNE_CAP_AUTO).not.toContain("vient d'écarter") // trop flou : « Publier » est revenu en premier juste après
})
test('/cap : des choix lisibles d un coup d œil, qui disent la durée et ce qui ne se rattrape pas', async () => {
  for (const mot of ['5 mots au plus, compte-les', 'verbe', 'combien de temps', 'irréversible', 'visible par d']) expect(CONSIGNE_CAP_AUTO).toContain(mot)
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
test('/plume : les consignes traitent la dictée et la demande déjà claire, avec des exemples, et réclament les repères', async () => {
  for (const r of ['dictée', 'déjà claire', 'Exemples', '<<<', '>>>', '⟦1⟧']) expect(SYSTEME_PLUME).toContain(r)
})
test('/plume : les passages collés sont montrés à part, avec leur repère', async () => {
  const p = promptPlume('corrige ça\n⟦1⟧', [], '', [ERREUR])
  expect(p).toContain(`⟦1⟧ :\n${ERREUR}`)
  expect(promptPlume('refais la page', [])).not.toContain('Passages collés')
})
test('/plume : avec toute la conversation, la consigne seule suffit : ni liste d outils ni résumé, et surtout ne pas répondre', async () => {
  const p = promptFork('refais-les\n⟦1⟧', [CODE])
  for (const r of [SYSTEME_PLUME, 'refais-les', 'aucun outil', `⟦1⟧ :\n${CODE}`]) expect(p).toContain(r)
  for (const r of ['Ce dont Claude dispose', 'Contexte récent']) expect(p).not.toContain(r)
})
test('/plume : les mots ajoutés par la réécriture sont repérés, sans tenir compte des majuscules ni de la ponctuation', async () => {
  expect(ajouts('euh tu peux enfin vérifier que la jauge elle coupe plus rien quoi', 'Vérifie que la jauge ne coupe plus rien.'))
    .toEqual([{ start: 0, end: 7 }, { start: 21, end: 23 }]) // « Vérifie », « ne »
  expect(ajouts('Ajoute un test.', 'Ajoute un test.')).toEqual([])
})
test('/plume : des mots ajoutés à la suite forment un seul passage en gras', async () => {
  expect(ajouts('refais la page', 'Refais la page d’accueil en entier.')).toEqual([{ start: 15, end: 35 }])
})
test('/plume : un trou à remplir est en gras d un seul tenant, ponctuation comprise', async () => {
  expect(ajouts('corrige le bouton', 'Corrige le bouton [à préciser : lequel ?].')).toEqual([{ start: 18, end: 42 }])
})
test('/plume : ce qui manque devient un trou à remplir, et un bug, une fonction ou une relecture prennent leur forme', async () => {
  for (const r of ['[à préciser :', 'Bug', "Ce que j'attends", 'nouvelle fonction', 'relecture']) expect(SYSTEME_PLUME).toContain(r)
  expect(SYSTEME_PLUME).not.toContain('poser la question avant d')
})
test('/plume : quand plus de la moitié des mots sont nouveaux, seuls les trous à remplir restent en gras (capture du 04/11/2026)', async () => {
  const avant = 'le bouton relais il marche plus quand je clique y se passe rien'
  const apres = "Bug : le bouton « ⇄ Relais » ne marche plus.\nCe que je fais : je clique sur « ⇄ Relais » dans la barre du bas.\n" +
    "Ce que j'attends : le relais se lance.\nCe qui se passe : rien, [à préciser : depuis quand ?]"
  expect(gras(avant, apres)).toEqual([{ start: apres.indexOf('[à préciser'), end: apres.length }])
  const petite = 'Corrige le bouton [à préciser : lequel ?].' // la moitié des mots, pas plus : tous les ajouts restent en gras
  expect(gras('corrige le bouton', petite)).toEqual(ajouts('corrige le bouton', petite))
  expect(gras('a '.repeat(3000), `${'b '.repeat(3000)}[à préciser : quoi ?]`)).toHaveLength(1) // trop long à comparer : le trou quand même
})
test('/plume : une très longue demande n est pas comparée mot à mot (trop lent), rien n est mis en gras', async () => {
  expect(ajouts('a '.repeat(3000), 'b '.repeat(3000))).toEqual([])
})
test('/plume : réponse nettoyée', async () => {
  expect(nettoyerReponse('  <<<\nTexte amélioré\n>>>  ')).toBe('Texte amélioré')
  expect(nettoyerReponse('```\nTexte\n```')).toBe('Texte')
  expect(nettoyerReponse('Texte simple')).toBe('Texte simple')
  expect(nettoyerReponse('Voici la demande réécrite :\n<<<\nTexte amélioré\n>>>\nBonne journée')).toBe('Texte amélioré')
})
test('/plume : une réponse ouverte par <<< mais jamais refermée est coupée, donc refusée', async () => {
  expect(nettoyerReponse('<<<\nDébut de la réécriture, puis plus rien')).toBeNull()
})

const ERREUR = "TypeError: x is undefined\n    at main (C:\\app\\index.js:12:5)\n    at run (C:\\app\\run.js:3:1)"
const CODE = '```js\nconst a = 1\n```'
test('/plume : un message d erreur et un bloc de code collés sont mis de côté, la demande reste à réécrire', async () => {
  const p = proteger(`corrige ça stp\n${ERREUR}\net regarde aussi\n${CODE}`)
  expect(p.blocs).toEqual([ERREUR, CODE])
  expect(p.texte).toBe('corrige ça stp\n⟦1⟧\net regarde aussi\n⟦2⟧')
})
test('/plume : une demande ordinaire, même avec un chemin de fichier, n a rien à mettre de côté', async () => {
  for (const t of ['corrige le bug dans src/app.ts stp', 'euh donc tu peux refaire les barres là en plus épais quoi', '- point un\n- point deux']) {
    expect(proteger(t)).toEqual({ texte: t, blocs: [] })
  }
})
test('/plume : les passages collés reviennent mot pour mot, et une réécriture qui en perd ou en double un est refusée', async () => {
  const { blocs } = proteger(`corrige ça\n${ERREUR}\n${'et ça'}\n${CODE}`)
  expect(restaurer("Corrige l'erreur ci-dessous.\n⟦1⟧\nRegarde aussi ce code :\n⟦2⟧", blocs)).toBe(`Corrige l'erreur ci-dessous.\n${ERREUR}\nRegarde aussi ce code :\n${CODE}`)
  expect(restaurer('Corrige l erreur.\n⟦1⟧', blocs)).toBeNull()
  expect(restaurer('⟦1⟧ ⟦1⟧ ⟦2⟧', blocs)).toBeNull()
  expect(restaurer('Texte sans passage', [])).toBe('Texte sans passage')
})

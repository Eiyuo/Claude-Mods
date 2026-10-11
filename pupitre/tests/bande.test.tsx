import { describe, expect, mock, test } from 'claude-code/testing'
import { dispositionJauge } from '../hooks/bande'

const BANDE = { component: 'AbovePrompt', props: { hasSurvey: false, isWorking: true, maxRows: 20, bodyColumns: 120 } } as const

describe('disposition de la jauge sur une ligne', () => {
  const m = [
    { nom: 'Contexte', pct: '86 %', court: '' },
    { nom: 'Limite 5 h', pct: '14 %', court: '↻ 2 h 12' },
    { nom: 'Limite 7 j', pct: '31 %', court: '↻ 5 j 5 h' },
  ]
  test('large : barres plafonnées, comptes à rebours gardés', async () => {
    expect(dispositionJauge(200, m, 40, 1)).toEqual({ barre: 20, avecCourt: true })
  })
  test('étroit : les comptes à rebours partent avant que les barres deviennent trop petites', async () => {
    expect(dispositionJauge(130, m, 40, 1)).toEqual({ barre: 11, avecCourt: false })
  })
  test('très étroit : jamais moins de 4 colonnes', async () => {
    expect(dispositionJauge(60, m, 40, 1)).toEqual({ barre: 4, avecCourt: false })
  })
  test('le texte du bureau, plus serré, garde les comptes à rebours là où le terminal les retire', async () => {
    expect(dispositionJauge(130, m, 40, 0.75)).toEqual({ barre: 10, avecCourt: true })
  })
})

test('pendant le travail, la bande dessine la ligne de Claude sur chaque surface', async ($, on) => {
  mock.store(on)
  mock.clock(on, { now: 1_000_000 })
  on('tool.call', async () => ({ result: { text: 'contenu' } }) as never)
  await $.command.run({ command: 'pupitre', args: '' })
  await $.tool.call({ tool: 'Read', input: { file_path: 'README.md' } })
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'pupitre', surface, ...BANDE })
    expect(JSON.stringify(await ui.drawn())).toContain('Claude')
    await ui.unmount()
  }
})

test('chaque barre a sa largeur et sa hauteur fixées (sinon le bureau lui donne 150 px de haut)', async ($, on) => {
  mock.store(on)
  mock.clock(on, { now: 1_000_000 })
  on('tool.call', async () => ({ result: { text: 'contenu' } }) as never)
  await $.command.run({ command: 'pupitre', args: '' })
  await $.tool.call({ tool: 'Read', input: { file_path: 'README.md' } })
  const ui = await $.ui.mount({ plugin: 'pupitre', surface: 'desktop', ...BANDE })
  const svgs = await ui.findAll({ type: 'Svg' })
  expect(svgs.length).toBe(4) // 3 mesures + la ligne de Claude
  for (const s of svgs) {
    expect(typeof s.props.width).toBe('number')
    expect(typeof s.props.height).toBe('number')
    expect(s.props.height as number).toBeLessThan(30)
  }
  await ui.unmount()
})

test('au repos, la jauge tient sur une seule ligne', async ($, on) => {
  mock.store(on)
  mock.clock(on, { now: 1_000_000 })
  await $.command.run({ command: 'pupitre', args: '' })
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'pupitre', surface, ...BANDE })
    const boites = await ui.findAll({ type: 'Box' })
    expect(boites.some(b => b.props.flexDirection === 'column')).toBe(false)
    await ui.unmount()
  }
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function preparer($: any, on: any) {
  mock.store(on)
  const horloge = mock.clock(on, { now: 1_000_000 })
  on('tool.call', async () => ({ result: { text: 'contenu' } }) as never)
  on('turn.start', async () => ({ turnId: 't1' }))
  on('turn.complete', async () => ({ text: '' }))
  await $.command.run({ command: 'pupitre', args: '' })
  return horloge
}

test('la jauge reste en bas, au plus près de la zone de texte ; /fil au-dessus', async ($, on) => {
  await preparer($, on)
  await $.tool.call({ tool: 'Read', input: { file_path: 'README.md' } })
  const ui = await $.ui.mount({ plugin: 'pupitre', surface: 'desktop', ...BANDE })
  const alts = (await ui.findAll({ type: 'Svg' })).map(x => String(x.props.alt))
  expect(alts[0]!.startsWith('Claude')).toBe(true)
  expect(alts[alts.length - 1]!.startsWith('Limite 7 jours')).toBe(true)
  await ui.unmount()
  const t = await $.ui.mount({ plugin: 'pupitre', surface: 'terminal', ...BANDE })
  const texte = JSON.stringify(await t.drawn())
  expect(texte.indexOf('Claude')).toBeLessThan(texte.indexOf('Contexte'))
  await t.unmount()
})

test('travail fini : la barre reste, avec « Fermer », jusqu à ce qu on la ferme', async ($, on) => {
  const horloge = await preparer($, on)
  await $.turn.start({ text: 'fais ceci', turnId: 't1' } as never)
  await $.tool.call({ tool: 'Read', input: { file_path: 'README.md' } })
  await $.tool.call({ tool: 'Read', input: { file_path: 'a.md' }, agentId: 'a1' } as never)
  const ui = await $.ui.mount({ plugin: 'pupitre', surface: 'desktop', ...BANDE })
  expect(await ui.find({ type: 'Button', text: 'Fermer' })).toBeUndefined() // pas pendant le travail
  await $.turn.complete({ answer: '', durationMs: 5000, isAborted: false, turnId: 't1', reason: 'answer' } as never)
  await horloge.advance(10_000)
  const avant = JSON.stringify(await ui.drawn())
  expect(avant).toContain('Claude')
  expect(avant).toContain('Sous-agent')
  expect(await ui.findAll({ type: 'Button', text: 'Fermer' })).toHaveLength(1)
  await ui.press({ key: 'fermer-fil' })
  const apres = JSON.stringify(await ui.drawn())
  expect(apres).not.toContain('Claude')
  expect(apres).not.toContain('Sous-agent')
  expect(apres).toContain('Contexte') // la jauge reste
  await ui.unmount()
})

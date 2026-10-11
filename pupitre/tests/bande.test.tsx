import { describe, expect, mock, test } from 'claude-code/testing'
import { PAR_CAR_BUREAU, dispositionJauge } from '../hooks/bande'

const BANDE = { component: 'AbovePrompt', props: { hasSurvey: false, isWorking: true, maxRows: 20, bodyColumns: 120 } } as const

describe('disposition de la jauge sur une ligne', () => {
  const m = [
    { nom: 'Contexte', abrege: 'Contexte', pct: '86 %', court: '' },
    { nom: 'Limite 5 h', abrege: '5 h', pct: '14 %', court: '↻ 2 h 12' },
    { nom: 'Limite 7 j', abrege: '7 j', pct: '31 %', court: '↻ 5 j 5 h' },
  ]
  test('large : barres plafonnées, comptes à rebours gardés', async () => {
    expect(dispositionJauge(200, m, 40, 1)).toEqual({ barre: 20, avecCourt: true, abrege: false })
  })
  test('étroit : les comptes à rebours partent avant que les barres deviennent trop petites', async () => {
    expect(dispositionJauge(130, m, 40, 1)).toEqual({ barre: 11, avecCourt: false, abrege: false })
  })
  test('très étroit : les noms raccourcissent, jamais moins de 4 colonnes de barre', async () => {
    expect(dispositionJauge(60, m, 40, 1)).toEqual({ barre: 4, avecCourt: false, abrege: true })
  })
  test('cas de la capture (94 colonnes, bureau) : tout tient, comptes à rebours compris', async () => {
    const capture = [
      { nom: 'Contexte', abrege: 'Contexte', pct: '33 %', court: '' },
      { nom: 'Limite 5 h', abrege: '5 h', pct: '18 %', court: '↻ 32 min' },
      { nom: 'Limite 7 jours', abrege: '7 jours', pct: '32 %', court: '↻ 5 j 3 h' },
    ]
    expect(dispositionJauge(94, capture, 0, PAR_CAR_BUREAU)).toEqual({ barre: 7, avecCourt: true, abrege: false })
  })
  test('la largeur choisie ne dépasse jamais la place, de 30 à 200 colonnes', async () => {
    for (const parCar of [1, PAR_CAR_BUREAU]) for (let c = 30; c <= 200; c++) {
      const d = dispositionJauge(c, m, 0, parCar)
      const texte = m.reduce((t, x) => {
        const court = d.avecCourt && x.court ? x.court.length : 0
        return t + Math.ceil(((d.abrege ? x.abrege : x.nom).length + x.pct.length + court) * parCar) + 2 + (court > 0 ? 1 : 0)
      }, 0)
      const total = texte + 3 * (m.length - 1) + d.barre * m.length
      if (!(d.abrege && d.barre === 4)) expect(total).toBeLessThanOrEqual(c) // le plancher seul peut déborder ; les textes se coupent alors avec « … »
    }
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

test('au repos : la jauge seule sur une ligne, les boutons sur la ligne du dessous', async ($, on) => {
  mock.store(on)
  mock.clock(on, { now: 1_000_000 })
  await $.command.run({ command: 'pupitre', args: '' })
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'pupitre', surface, ...BANDE })
    const arbre = (await ui.drawn()) as unknown as { props: Record<string, unknown>; children: unknown[] }
    expect(arbre.props.flexDirection).toBe('column')
    expect(arbre.children).toHaveLength(2)
    const [haut, bas] = arbre.children.map(c => JSON.stringify(c))
    expect(haut).toContain('Contexte')
    expect(haut).toContain('Limite 7 jours')
    expect(haut).not.toContain('"Button"')
    expect(bas).toContain('Réglages')
    expect(bas).not.toContain('Contexte')
    await ui.unmount()
  }
})

test('aucun texte de la jauge ne passe à la ligne', async ($, on) => {
  mock.store(on)
  mock.clock(on, { now: 1_000_000 })
  await $.command.run({ command: 'pupitre', args: '' })
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'pupitre', surface, ...BANDE })
    const textes = await ui.findAll({ type: 'Text' })
    expect(textes.length).toBeGreaterThan(5)
    for (const t of textes) expect(t.props.wrap).toBe('truncate')
    await ui.unmount()
  }
})

test('jauge éteinte : il ne reste que la ligne des boutons', async ($, on) => {
  mock.store(on)
  mock.clock(on, { now: 1_000_000 })
  await $.command.run({ command: 'pupitre', args: '' })
  await $.command.run({ command: 'jauge', args: '' })
  const ui = await $.ui.mount({ plugin: 'pupitre', surface: 'desktop', ...BANDE })
  const arbre = JSON.stringify(await ui.drawn())
  expect(arbre).toContain('Réglages')
  expect(arbre).not.toContain('Contexte')
  expect(arbre).not.toContain('"flexDirection":"column"')
  await ui.unmount()
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function preparer($: any, on: any) {
  mock.store(on)
  const horloge = mock.clock(on, { now: 1_000_000 })
  on('tool.call', async () => ({ result: { text: 'contenu' } }) as never)
  on('turn.start', async () => ({ turnId: 't1' }))
  on('turn.complete', async () => ({ text: '' }))
  on('ui.render', async () => ({ type: 'Text', props: {}, children: ['(bande du moteur)'] }) as never) // ce que le moteur dessine quand le mod passe la main
  await $.command.run({ command: 'pupitre', args: '' })
  return horloge
}

test('/fil au-dessus de la jauge, les boutons en dessous', async ($, on) => {
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
  expect(texte.indexOf('Contexte')).toBeLessThan(texte.indexOf('Réglages'))
  await t.unmount()
})

test('travail fini : la barre reste, avec une croix « Fermer », jusqu à ce qu on la ferme', async ($, on) => {
  const horloge = await preparer($, on)
  await $.turn.start({ text: 'fais ceci', turnId: 't1' } as never)
  await $.tool.call({ tool: 'Read', input: { file_path: 'README.md' } })
  await $.tool.call({ tool: 'Read', input: { file_path: 'a.md' }, agentId: 'a1' } as never)
  const ui = await $.ui.mount({ plugin: 'pupitre', surface: 'desktop', ...BANDE })
  const croix = async () => (await ui.findAll({ type: 'Button' })).filter(b => b.key === 'fermer-fil')
  expect(await croix()).toHaveLength(0) // pas pendant le travail
  await $.turn.complete({ answer: '', durationMs: 5000, isAborted: false, turnId: 't1', reason: 'answer' } as never)
  await horloge.advance(10_000)
  const avant = JSON.stringify(await ui.drawn())
  expect(avant).toContain('Claude')
  expect(avant).toContain('Sous-agent')
  const [x, ...autresCroix] = await croix()
  expect(autresCroix).toHaveLength(0)
  // Le bureau ne dessine d'un Button que son label (ni son contenu, ni role « dismiss » dans cette bande,
  // vérifié sur capture) : la croix doit être le label lui-même.
  expect(x!.props.label).toBe('×')
  expect(x!.props.role).toBeUndefined()
  await ui.press({ key: 'fermer-fil' })
  const apres = JSON.stringify(await ui.drawn())
  expect(apres).not.toContain('Claude')
  expect(apres).not.toContain('Sous-agent')
  expect(apres).toContain('Contexte') // la jauge reste
  await ui.unmount()
})

test('aucune barre en cadre interactif : un cadre se recharge à chaque changement et fait clignoter la barre', async ($, on) => {
  await preparer($, on)
  await $.tool.call({ tool: 'Read', input: { file_path: 'README.md' } })
  const ui = await $.ui.mount({ plugin: 'pupitre', surface: 'desktop', ...BANDE })
  const svgs = await ui.findAll({ type: 'Svg' })
  expect(svgs.length).toBe(4)
  for (const s of svgs) expect(s.props.isInteractive ?? false).toBe(false)
  await ui.unmount()
})

const libelles = async (ui: { findAll: (q: { type: string }) => Promise<{ props: Record<string, unknown> }[]> }) =>
  (await ui.findAll({ type: 'Button' })).map(b => String(b.props.label))

test('« Réglages » déplie une ligne avec un bouton par fonction, puis se replie', async ($, on) => {
  await preparer($, on)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'pupitre', surface, ...BANDE })
    expect(await libelles(ui)).toEqual(['Passer le relais', 'Améliorer le prompt', 'Réglages'])
    await ui.press({ key: 'reglages' })
    const ouverts = await libelles(ui)
    for (const l of ['✓ Jauge', '✓ Fil', '✓ Relais', '✓ Plume', 'Tout éteindre', 'Replier']) expect(ouverts).toContain(l)
    await ui.press({ key: 'replier' })
    expect(await libelles(ui)).toEqual(['Passer le relais', 'Améliorer le prompt', 'Réglages'])
    await ui.unmount()
  }
})

test('un bouton de réglage éteint puis rallume sa fonction', async ($, on) => {
  await preparer($, on)
  const ui = await $.ui.mount({ plugin: 'pupitre', surface: 'desktop', ...BANDE })
  await ui.press({ key: 'reglages' })
  await ui.press({ key: 'basculer-jauge' })
  expect(await libelles(ui)).toContain('○ Jauge')
  expect(await libelles(ui)).toContain('Tout allumer')
  expect(JSON.stringify(await ui.drawn())).not.toContain('Contexte')
  await ui.press({ key: 'basculer-relais' })
  expect(await libelles(ui)).not.toContain('Passer le relais')
  await ui.press({ key: 'basculer-jauge' })
  expect(JSON.stringify(await ui.drawn())).toContain('Contexte')
  await ui.unmount()
})

test('« Réglages » reste accessible quand seul le fil est allumé', async ($, on) => {
  await preparer($, on)
  for (const command of ['jauge', 'relais', 'plume']) await $.command.run({ command, args: '' })
  const ui = await $.ui.mount({ plugin: 'pupitre', surface: 'desktop', ...BANDE })
  expect(await libelles(ui)).toEqual(['Réglages'])
  await ui.unmount()
})

test('« Tout éteindre » retire la bande', async ($, on) => {
  await preparer($, on)
  const ui = await $.ui.mount({ plugin: 'pupitre', surface: 'desktop', ...BANDE })
  await ui.press({ key: 'reglages' })
  await ui.press({ key: 'tout' })
  expect(await ui.find({ type: 'Button', text: 'Réglages' })).toBeUndefined()
  await ui.unmount()
})

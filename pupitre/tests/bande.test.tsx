import { describe, expect, mock, test } from 'claude-code/testing'
import { PAR_CAR_BUREAU, dispositionJauge, titreAutre } from '../hooks/bande'
import { CONSIGNE_CAP_AUTO } from '../hooks/textes'
import { ficheDe } from '../hooks/partage'
import type { LigneFil } from '../types'

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

test('titre d une autre discussion : le dossier raccourci laisse la place à la demande', async () => {
  expect(titreAutre('Envoie 2 sous-agents en parallèle', 'essai-relais')).toBe('Envoie 2 sous-… · essai-r…')
  expect(titreAutre('Ajoute du beurre', 'Atelier')).toBe('Ajoute du beurre · Atelier')
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
  expect(avant).toContain('fais ceci') // la demande sert de titre
  expect(avant).toContain('Sous-agent')
  const [x, ...autresCroix] = await croix()
  expect(autresCroix).toHaveLength(0)
  // Le bureau ne dessine d'un Button que son label (ni son contenu, ni role « dismiss » dans cette bande,
  // vérifié sur capture) : la croix doit être le label lui-même.
  expect(x!.props.label).toBe('×')
  expect(x!.props.role).toBeUndefined()
  await ui.press({ key: 'fermer-fil' })
  const apres = JSON.stringify(await ui.drawn())
  expect(apres).not.toContain('fais ceci')
  expect(apres).not.toContain('Sous-agent')
  expect(apres).toContain('Contexte') // la jauge reste
  await ui.unmount()
})

test('autre discussion finie : sa ligne reste, avec sa croix, même une fois l autre discussion fermée', async ($, on) => {
  let fiche = ''
  let ecriteLe = 0
  mock.env(on, { USERPROFILE: 'C:/Users/essai' })
  on('fs.write', async () => ({ value: undefined }) as never)
  on('fs.list', async () => ({ value: fiche ? [{ name: 'autre.json', mtimeMs: ecriteLe }] : [] }) as never)
  on('fs.read', async () => ({ value: fiche }) as never)
  on('session.start', async (_: unknown, e: { cwd: string }) => ({ cwd: e.cwd }))
  on('command.register', async () => ({ value: undefined }) as never)
  on('session.id', async () => ({ value: 'moi' }) as never)
  on('session.cwd', async () => ({ value: 'C:/Users/essai/ici' }) as never)
  on('session.usage', async () => ({ value: { context: { window: 200_000 }, rateLimits: [] } }) as never)
  const horloge = await preparer($, on)
  await $.session.start({ cwd: 'C:/Users/essai/ici', surface: 'desktop', isInteractive: true })
  const L: LigneFil = { id: 'claude', qui: 'Claude', tache: 'En cours', mot: 'Lecture', compteur: '≈', progression: 0.3, avant: 0, niveau: 1, niveauAvant: 1, fini: false, eclat: false, debut: horloge.now(), majLe: horloge.now(), finiLe: null }
  const poser = (l: LigneFil) => { ecriteLe = horloge.now(); fiche = JSON.stringify(ficheDe('autre', 'Atelier', l, ecriteLe)) }
  poser(L)
  await horloge.advance(2_000)
  const ui = await $.ui.mount({ plugin: 'pupitre', surface: 'desktop', ...BANDE })
  const croix = async () => (await ui.findAll({ type: 'Button' })).filter(b => b.key === 'fermer-autre')
  expect(JSON.stringify(await ui.drawn())).toContain('Atelier')
  expect(await croix()).toHaveLength(0) // pas pendant le travail
  poser({ ...L, fini: true, finiLe: horloge.now(), tache: 'Terminé', compteur: '✓', mot: '✓ Fini', progression: 1, niveau: 3 })
  await horloge.advance(2_000)
  fiche = '' // l'autre discussion se ferme
  await horloge.advance(60_000)
  const reste = JSON.stringify(await ui.drawn())
  expect(reste).toContain('Atelier')
  expect(reste).toContain('100 %')
  const [x] = await croix()
  expect(x!.props.label).toBe('×')
  await ui.press({ key: 'fermer-autre' })
  expect(JSON.stringify(await ui.drawn())).not.toContain('Atelier')
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

test('chaque image porte l heure de son dessin, puis garde le même texte tant qu elle ne change pas', async ($, on) => {
  const horloge = await preparer($, on)
  await $.tool.call({ tool: 'Read', input: { file_path: 'README.md' } })
  await horloge.advance(2_500)
  const ui = await $.ui.mount({ plugin: 'pupitre', surface: 'desktop', ...BANDE })
  const svgs = await ui.findAll({ type: 'Svg' })
  expect(svgs.length).toBe(4)
  for (const s of svgs) expect(String(s.props.source)).toContain('--t:-1002.50s')
  await ui.unmount()
  // une seconde plus tard, la bande est redessinée (le chrono avance) : les images, inchangées, n'ont rien à recharger
  await horloge.advance(1_000)
  const apres = await $.ui.mount({ plugin: 'pupitre', surface: 'desktop', ...BANDE })
  expect(JSON.stringify(await apres.drawn())).toContain('0:03')
  expect((await apres.findAll({ type: 'Svg' })).map(s => s.props.source)).toEqual(svgs.map(s => s.props.source))
  await apres.unmount()
})

// Sur l'application, ce qu'un mod ajoute au prompt système n'arrive pas à Claude (vu à l'essai du relais) :
// la consigne entière part donc dans le message.
test('relais : la demande part toute seule, consigne entière dans le message', async ($, on) => {
  const envoyes: string[] = []
  on('prompt.submit', async ($, e) => { envoyes.push(e.text); return { text: e.text } as never })
  const horloge = await preparer($, on)
  const ui = await $.ui.mount({ plugin: 'pupitre', surface: 'desktop', ...BANDE })
  await ui.press({ key: 'relais' })
  await horloge.advance(10)
  expect(envoyes).toHaveLength(1)
  expect(envoyes[0]).toContain('Passer le relais')
  expect(envoyes[0]).toContain('claude --resume')
  await ui.unmount()
})

test('relais : si la demande ne part pas, elle attend dans la zone de texte', async ($, on) => {
  const remplis: string[] = []
  on('prompt.submit', async () => ({ drop: 'session occupée' }) as never)
  on('prompt.fill', async ($, e) => { remplis.push(e.text); return { isFilled: true } as never })
  const horloge = await preparer($, on)
  const ui = await $.ui.mount({ plugin: 'pupitre', surface: 'desktop', ...BANDE })
  await ui.press({ key: 'relais' })
  await horloge.advance(10)
  expect(remplis).toHaveLength(1)
  expect(remplis[0]).toContain('Passer le relais')
  await ui.unmount()
})

test('cap automatique : la consigne part avec chacun de tes messages tant que /cap est allumé', async ($, on) => {
  const recus: (readonly string[] | undefined)[] = []
  on('prompt.submit', async ($, e) => { recus.push(e.context); return { text: e.text } as never })
  await preparer($, on) // /pupitre allume tout, cap compris
  await $.prompt.submit({ text: 'fais ceci' })
  await $.prompt.submit({ text: '/fil' }) // une commande part telle quelle
  await $.command.run({ command: 'cap', args: '' })
  await $.prompt.submit({ text: 'fais cela' })
  expect(recus[0] ?? []).toContain(CONSIGNE_CAP_AUTO)
  expect(recus[1] ?? []).not.toContain(CONSIGNE_CAP_AUTO)
  expect(recus[2] ?? []).not.toContain(CONSIGNE_CAP_AUTO)
})

const svgFil = async (ui: { findAll: (q: { type: string }) => Promise<{ props: Record<string, unknown> }[]> }) =>
  (await ui.findAll({ type: 'Svg' })).filter(x => !/^(Contexte|Limite)/.test(String(x.props.alt)))

test('une ligne par travail : la demande en titre, le pourcentage, et toutes les barres de la même largeur', async ($, on) => {
  await preparer($, on)
  await $.turn.start({ text: 'Analyse le dossier radar-youtube', turnId: 't1' } as never)
  await $.tool.call({ tool: 'Read', input: { file_path: 'README.md' } })
  await $.tool.call({ tool: 'Read', input: { file_path: 'a.md' }, agentId: 'a1' } as never)
  await $.turn.complete({ answer: '', durationMs: 5000, isAborted: false, turnId: 't1', reason: 'answer' } as never)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'pupitre', surface, ...BANDE })
    const texte = JSON.stringify(await ui.drawn())
    expect(texte).toContain('Analyse le dossier radar-youtube')
    expect(texte).toContain('100 %')
    expect(texte).not.toContain('Terminé') // le titre reste la demande
    if (surface === 'desktop') {
      const largeurs = (await svgFil(ui)).map(x => x.props.width)
      expect(largeurs).toHaveLength(2) // Claude et son sous-agent ; la croix ne raccourcit pas la première
      expect(new Set(largeurs).size).toBe(1)
    }
    await ui.unmount()
  }
})

test('une demande envoyée par un mod : le titre est sa demande, pas la phrase que le moteur ajoute devant', async ($, on) => {
  await preparer($, on)
  await $.turn.start({ text: 'The pupitre plugin sent a message:\nPasser le relais. Écris le fichier relais.md', turnId: 't1' } as never)
  const ui = await $.ui.mount({ plugin: 'pupitre', surface: 'terminal', ...BANDE })
  const texte = JSON.stringify(await ui.drawn())
  expect(texte).toContain('Passer le relais. Écris')
  expect(texte).not.toContain('plugin sent a message')
  await ui.unmount()
})

test('un tour relancé par un message technique (« <agent-message … ») garde le titre de ta demande', async ($, on) => {
  await preparer($, on)
  await $.turn.start({ text: 'fais ceci', turnId: 't1' } as never)
  await $.turn.complete({ answer: '', durationMs: 2000, isAborted: false, turnId: 't1', reason: 'answer' } as never)
  await $.turn.start({ text: '<agent-message from="a1">résumé du sous-agent</agent-message>', turnId: 't2' } as never)
  const ui = await $.ui.mount({ plugin: 'pupitre', surface: 'terminal', ...BANDE })
  const texte = JSON.stringify(await ui.drawn())
  expect(texte).toContain('fais ceci')
  expect(texte).not.toContain('agent-message')
  await ui.unmount()
})

test('« Effacer les barres finies » : dès 2 barres finies, retire les vertes et garde celles en cours', async ($, on) => {
  await preparer($, on)
  await $.turn.start({ text: 'fais ceci', turnId: 't1' } as never)
  await $.tool.call({ tool: 'Read', input: { file_path: 'a.md' }, agentId: 'a1' } as never)
  await $.tool.call({ tool: 'Read', input: { file_path: 'b.md' }, agentId: 'a2' } as never)
  await $.turn.complete({ answer: '', durationMs: 2000, isAborted: false, turnId: 't1', reason: 'answer', agentId: 'a1' } as never)
  const ui = await $.ui.mount({ plugin: 'pupitre', surface: 'desktop', ...BANDE })
  expect(await libelles(ui)).not.toContain('Effacer les barres finies') // une seule barre finie : sa croix suffit
  await $.turn.complete({ answer: '', durationMs: 2000, isAborted: false, turnId: 't1', reason: 'answer', agentId: 'a2' } as never)
  expect(await libelles(ui)).toContain('Effacer les barres finies')
  await ui.press({ key: 'effacer' })
  const texte = JSON.stringify(await ui.drawn())
  expect(texte).not.toContain('Sous-agent') // les deux sous-agents finis sont partis
  expect(texte).toContain('fais ceci') // Claude travaille encore : sa ligne reste
  expect(await libelles(ui)).not.toContain('Effacer les barres finies')
  await ui.unmount()
})

test('un sous-agent fini reste affiché jusqu à la croix, même pendant que Claude travaille', async ($, on) => {
  const horloge = await preparer($, on)
  await $.turn.start({ text: 'fais ceci', turnId: 't1' } as never)
  await $.tool.call({ tool: 'Read', input: { file_path: 'a.md' }, agentId: 'a1' } as never)
  await $.turn.complete({ answer: '', durationMs: 2000, isAborted: false, turnId: 't1', reason: 'answer', agentId: 'a1' } as never)
  await horloge.advance(10_000)
  const ui = await $.ui.mount({ plugin: 'pupitre', surface: 'desktop', ...BANDE })
  expect(JSON.stringify(await ui.drawn())).toContain('Sous-agent')
  await ui.unmount()
})

test('cache : la part de la dernière demande lue dans le cache, sous la jauge, et un clic l explique', async ($, on) => {
  const toasts: string[] = []
  on('ui.toast', async ($, e) => { toasts.push(e.text); return { value: undefined } as never })
  await preparer($, on)
  await $.turn.start({ text: 'fais ceci', turnId: 't1' } as never)
  await $.turn.complete({ answer: '', durationMs: 2000, isAborted: false, turnId: 't1', reason: 'answer', usage: { model: 'm', input_tokens: 10, cache_read_input_tokens: 82, cache_creation_input_tokens: 8, output_tokens: 5 } } as never)
  const ui = await $.ui.mount({ plugin: 'pupitre', surface: 'desktop', ...BANDE })
  expect(JSON.stringify(await ui.drawn())).toContain('Cache 82 %')
  await ui.press({ key: 'cache' })
  expect(toasts.some(t => t.includes('82 %') && t.includes('déjà en mémoire'))).toBe(true)
  await ui.unmount()
})

const mesurer = (pct: number) => ({ context: { tokens: pct * 10, window: 1000, percent: pct }, rateLimits: [], changed: ['context'] }) as never

test('relais au bon moment : au-delà du seuil, le bouton affiche le contexte et une notification prévient une fois', async ($, on) => {
  const toasts: string[] = []
  on('ui.toast', async ($, e) => { toasts.push(e.text); return { value: undefined } as never })
  on('session.measure', async ($, e) => ({ changed: e.changed }) as never)
  await preparer($, on)
  await $.session.measure(mesurer(55))
  const ui = await $.ui.mount({ plugin: 'pupitre', surface: 'desktop', ...BANDE })
  expect(await libelles(ui)).toContain('Passer le relais')
  await $.session.measure(mesurer(62))
  await $.session.measure(mesurer(64))
  expect(await libelles(ui)).toContain('Passer le relais · 64 %')
  expect(toasts.filter(t => t.includes('relais'))).toHaveLength(1)
  await ui.unmount()
})

test('relais au bon moment : seuil réglable, et relais lancé tout seul en automatique', async ($, on) => {
  const envoyes: string[] = []
  on('prompt.submit', async ($, e) => { envoyes.push(e.text); return { text: e.text } as never })
  on('session.measure', async ($, e) => ({ changed: e.changed }) as never)
  const horloge = await preparer($, on)
  const ui = await $.ui.mount({ plugin: 'pupitre', surface: 'desktop', ...BANDE })
  await ui.press({ key: 'reglages' })
  expect(JSON.stringify(await ui.drawn())).toContain('60 %')
  await ui.press({ key: 'seuil-plus' })
  expect(JSON.stringify(await ui.drawn())).toContain('65 %')
  await ui.press({ key: 'relais-auto' })
  await $.session.measure(mesurer(62))
  await horloge.advance(10)
  expect(envoyes).toHaveLength(0) // sous le seuil de 65 %
  await $.session.measure(mesurer(66))
  await horloge.advance(10)
  expect(envoyes).toHaveLength(1)
  expect(envoyes[0]).toContain('Passer le relais')
  await ui.unmount()
})

test('relais demandé pendant un tour : traité à la fin de son propre tour, relais.md cherché à la racine du projet', async ($, on) => {
  const envoyes: string[] = []
  const toasts: string[] = []
  const commandes: string[] = []
  let boite = ''
  let relaisLe: number | null = null
  on('prompt.submit', async ($, e) => { envoyes.push(e.text); return { text: e.text } as never })
  on('prompt.fill', async ($, e) => { boite = e.text; return { isFilled: true } as never })
  on('ui.toast', async ($, e) => { toasts.push(e.text); return { value: undefined } as never })
  on('command.run', { command: 'clear' }, async () => { commandes.push('clear'); return { text: '' } as never })
  on('session.root', async () => ({ value: 'C:/projet' }) as never)
  on('session.cwd', async () => ({ value: 'C:/projet/pupitre' }) as never) // Claude a fait « cd pupitre » pour les tests
  on('fs.stat', async ($, e) => {
    // le moteur rend le chemin à la façon Windows
    if (e.path.replace(/\\/g, '/') === 'C:/projet/relais.md' && relaisLe !== null) return { value: { kind: 'file', size: 10, mtimeMs: relaisLe, isLink: false } } as never
    throw new Error('absent')
  })
  const horloge = await preparer($, on)
  const ui = await $.ui.mount({ plugin: 'pupitre', surface: 'desktop', ...BANDE })
  await $.turn.start({ text: 'un long travail', turnId: 't1' } as never)
  await ui.press({ key: 'relais' })
  await horloge.advance(10)
  const consigne = envoyes.find(t => t.includes('Passer le relais'))!
  expect(consigne).toBeDefined()
  await $.turn.complete({ answer: '', durationMs: 1000, isAborted: false, turnId: 't1', reason: 'answer' } as never)
  expect(toasts.some(t => t.includes("n'a pas été écrit"))).toBe(false) // le tour fini n'était pas celui du relais
  await $.turn.start({ text: `The pupitre plugin sent a message:\n${consigne}`, turnId: 't2' } as never)
  relaisLe = 2_000_000_000_000
  await $.turn.complete({ answer: '', durationMs: 1000, isAborted: false, turnId: 't2', reason: 'answer' } as never)
  await horloge.advance(400)
  expect(commandes).toEqual(['clear'])
  expect(boite).toContain('Lis relais.md')
  await ui.unmount()
})

test('relais automatique : un dépassement mesuré en plein tour lance le relais à la fin du tour', async ($, on) => {
  const envoyes: string[] = []
  on('prompt.submit', async ($, e) => { envoyes.push(e.text); return { text: e.text } as never })
  on('session.measure', async ($, e) => ({ changed: e.changed }) as never)
  const horloge = await preparer($, on)
  const ui = await $.ui.mount({ plugin: 'pupitre', surface: 'desktop', ...BANDE })
  await ui.press({ key: 'reglages' })
  await ui.press({ key: 'relais-auto' })
  await $.turn.start({ text: 'un long travail', turnId: 't1' } as never)
  await $.session.measure(mesurer(66))
  await horloge.advance(10)
  expect(envoyes).toHaveLength(0) // pas au milieu du travail
  await $.turn.complete({ answer: '', durationMs: 1000, isAborted: false, turnId: 't1', reason: 'answer' } as never)
  await horloge.advance(10)
  expect(envoyes.filter(t => t.includes('Passer le relais'))).toHaveLength(1)
  await ui.unmount()
})

test('« Améliorer le prompt » : si tu as continué à écrire pendant l amélioration, ton texte n est pas remplacé', async ($, on) => {
  let boite = 'refais-les'
  const toasts: string[] = []
  on('prompt.read', async () => ({ value: { text: boite, cursor: boite.length } }) as never)
  on('prompt.fill', async ($, e) => { boite = e.text; return { isFilled: true } as never })
  on('ui.toast', async ($, e) => { toasts.push(e.text); return { value: undefined } as never })
  on('model.complete', async () => { boite = 'refais-les plus jolies, et vite'; return { value: { isAnswered: true, text: 'Réécrit.', usage: {} } } as never })
  await preparer($, on)
  const ui = await $.ui.mount({ plugin: 'pupitre', surface: 'desktop', ...BANDE })
  await ui.press({ key: 'plume' })
  expect(boite).toBe('refais-les plus jolies, et vite')
  expect(toasts.some(t => t.includes('changé'))).toBe(true)
  expect(await libelles(ui)).toContain('Améliorer le prompt')
  await ui.unmount()
})

test('« Améliorer le prompt » : un modèle qui refuse l appel ne bloque pas le bouton', async ($, on) => {
  const toasts: string[] = []
  on('prompt.read', async () => ({ value: { text: 'refais-les', cursor: 10 } }) as never)
  on('ui.toast', async ($, e) => { toasts.push(e.text); return { value: undefined } as never })
  on('model.complete', async () => { throw new Error('modèle non autorisé') })
  await preparer($, on)
  const ui = await $.ui.mount({ plugin: 'pupitre', surface: 'desktop', ...BANDE })
  await ui.press({ key: 'plume' })
  expect(toasts.some(t => t.includes('Amélioration impossible'))).toBe(true)
  expect(await libelles(ui)).toContain('Améliorer le prompt')
  await ui.unmount()
})

test('première installation : sans réglage enregistré, la bande s affiche sans taper /pupitre', async ($, on) => {
  mock.store(on)
  mock.clock(on, { now: 1_000_000 })
  mock.env(on, { USERPROFILE: 'C:/Users/essai' })
  on('session.start', async (_: unknown, e: { cwd: string }) => ({ cwd: e.cwd }))
  on('command.register', async () => ({ value: undefined }) as never)
  on('session.id', async () => ({ value: 'moi' }) as never)
  on('session.cwd', async () => ({ value: 'C:/Users/essai/ici' }) as never)
  on('session.usage', async () => ({ value: { context: { window: 200_000 }, rateLimits: [] } }) as never)
  on('ui.render', async () => ({ type: 'Text', props: {}, children: ['(bande du moteur)'] }) as never)
  await $.session.start({ cwd: 'C:/Users/essai/ici', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ plugin: 'pupitre', surface: 'desktop', ...BANDE })
  expect(await libelles(ui)).toEqual(['Passer le relais', 'Améliorer le prompt', 'Réglages'])
  await ui.unmount()
})

test('carillon : sous Windows, c est PowerShell qui joue le son du mod (le moteur n y joue rien)', async ($, on) => {
  mock.env(on, { OS: 'Windows_NT', USERPROFILE: 'C:/Users/essai' })
  const lances: string[] = []
  on('process.run', async ($, e) => { lances.push(e.argv.join(' ')); return { value: { exitCode: 0, stdout: '', stderr: '' } } as never })
  await preparer($, on)
  await $.turn.start({ text: 'fais ceci', turnId: 't1' } as never)
  await $.turn.complete({ answer: '', durationMs: 31_000, isAborted: false, turnId: 't1', reason: 'answer' } as never)
  expect(lances).toHaveLength(1)
  expect(lances[0]).toContain('powershell')
  expect(lances[0]).toContain('assets/carillon.wav')
})

test('« Améliorer le prompt » : réécrit avec la conversation, et « Revenir à mon texte » reste jusqu à l envoi', async ($, on) => {
  const demandes: string[] = []
  let boite = 'refais-les plus jolies'
  on('prompt.read', async () => ({ value: { text: boite, cursor: boite.length } }) as never)
  on('prompt.fill', async ($, e) => { boite = e.text; return { isFilled: true } as never })
  on('session.messages', async () => ({ value: [{ role: 'user', text: 'parle-moi des barres', toolUses: [] }, { role: 'assistant', text: 'Voici les barres du fil.', toolUses: [] }] }) as never)
  on('model.complete', async ($, e) => { demandes.push(e.prompt); return { value: { isAnswered: true, text: 'Rends les barres du fil plus jolies.', usage: {} } } as never })
  on('prompt.submit', async ($, e) => ({ text: e.text }) as never)
  const horloge = await preparer($, on)
  const ui = await $.ui.mount({ plugin: 'pupitre', surface: 'desktop', ...BANDE })
  await ui.press({ key: 'plume' })
  expect(demandes[0]).toContain('Voici les barres du fil.')
  expect(boite).toBe('Rends les barres du fil plus jolies.')
  await horloge.advance(120_000) // le temps de relire : le retour reste possible
  expect(await libelles(ui)).toContain('Revenir à mon texte')
  await $.prompt.submit({ text: boite })
  expect(await libelles(ui)).toContain('Améliorer le prompt')
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
    for (const l of ['✓ Jauge', '✓ Fil', '✓ Relais', '✓ Plume', '✓ Cap', 'Tout éteindre', 'Replier', '−', '+', '○ Automatique']) expect(ouverts).toContain(l)
    expect(JSON.stringify(await ui.drawn())).toContain('Relais à :')
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

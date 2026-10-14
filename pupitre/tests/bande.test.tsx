import { describe, expect, mock, test } from 'claude-code/testing'
import { dispositionJauge, largeurBureau, titreAutre } from '../hooks/bande'
import { CONSIGNE_CAP_AUTO, DEBUT_RELAIS } from '../hooks/textes'
import { ficheDe } from '../hooks/partage'
import type { LigneFil } from '../types'

const BANDE = { component: 'AbovePrompt', props: { hasSurvey: false, isWorking: true, maxRows: 20, bodyColumns: 120 } } as const

describe('disposition de la jauge sur une ligne', () => {
  const m = [
    { nom: 'Contexte', abrege: 'Contexte', pct: '86 %', court: '' },
    { nom: 'Limite 5 h', abrege: '5 h', pct: '14 %', court: '↻ 2 h 12' },
    { nom: 'Limite 7 j', abrege: '7 j', pct: '31 %', court: '↻ 5 j 5 h' },
  ]
  const terminal = (t: string) => t.length
  test('large : barres plafonnées, comptes à rebours gardés', async () => {
    expect(dispositionJauge(200, m, terminal)).toEqual({ barre: 20, avecCourt: true, abrege: false })
  })
  test('étroit : les comptes à rebours partent avant que les barres deviennent trop petites', async () => {
    expect(dispositionJauge(80, m, terminal)).toEqual({ barre: 9, avecCourt: false, abrege: false })
  })
  test('très étroit : les noms raccourcissent, jamais moins de 4 colonnes de barre', async () => {
    expect(dispositionJauge(40, m, terminal)).toEqual({ barre: 4, avecCourt: false, abrege: true })
  })
  test('sur le bureau, chaque texte est estimé lettre par lettre, jamais sous sa largeur mesurée sur capture', async () => {
    // en colonnes de 8 px, mesurées sur la capture du 12/10/2026
    for (const [t, gras, mesure] of [['Contexte', false, 7.1], ['Limite 5 h', false, 7.2], ['Limite 7 jours', false, 10.0], ['54 %', true, 4.0],
      ['36 %', true, 3.8], ['49 %', true, 3.9], ['↻ 1 h 57', false, 5.6], ['↻ 4 j 0 h', false, 5.9]] as const) {
      expect(largeurBureau(t, gras)).toBeGreaterThanOrEqual(mesure)
      expect(largeurBureau(t, gras)).toBeLessThanOrEqual(mesure * 1.15) // assez juste pour serrer la ligne
    }
  })
  test('cas de la capture (94 colonnes, bureau) : tout tient sur une ligne, en barres de 10', async () => {
    const capture = [
      { nom: 'Contexte', abrege: 'Contexte', pct: '54 %', court: '' },
      { nom: 'Limite 5 h', abrege: '5 h', pct: '36 %', court: '↻ 1 h 57' },
      { nom: 'Limite 7 jours', abrege: '7 jours', pct: '49 %', court: '↻ 4 j 0 h' },
    ]
    expect(dispositionJauge(94, capture, largeurBureau)).toEqual({ barre: 10, avecCourt: true, abrege: false })
  })
  test('la largeur choisie ne dépasse jamais la place, de 30 à 200 colonnes', async () => {
    for (const l of [terminal, largeurBureau]) for (let c = 30; c <= 200; c++) {
      const d = dispositionJauge(c, m, l)
      const texte = m.reduce((t, x) => t + l(d.abrege ? x.abrege : x.nom) + l(x.pct, true) + 2 + (d.avecCourt && x.court ? l(x.court) + 1 : 0), 0)
      const trait = 2 + l('│') // un écart de chaque côté du trait
      const total = texte + trait * (m.length - 1) + d.barre * m.length
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

test('au repos : la jauge seule sur une ligne, les boutons sur la ligne du dessous (sur le bureau, au pied de la zone de texte)', async ($, on) => {
  mock.store(on)
  mock.clock(on, { now: 1_000_000 })
  await $.command.run({ command: 'pupitre', args: '' })
  const ui = await $.ui.mount({ plugin: 'pupitre', surface: 'terminal', ...BANDE })
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
  const bureau = await $.ui.mount({ plugin: 'pupitre', surface: 'desktop', ...BANDE })
  const jauge = JSON.stringify(await bureau.drawn())
  expect(jauge).toContain('Limite 7 jours')
  expect(jauge).not.toContain('"Button"')
  await bureau.unmount()
  const pied = await $.ui.mount({ plugin: 'pupitre', surface: 'desktop', ...PIED })
  expect(JSON.stringify(await pied.drawn())).toContain('⚙')
  await pied.unmount()
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
  const ui = await $.ui.mount({ plugin: 'pupitre', surface: 'terminal', ...BANDE }) // sur le bureau, les boutons sont au pied
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

// Sur le bureau, la ligne des boutons est au pied de la zone de texte (SessionMode) ; ailleurs, dans la bande.
const PIED = { component: 'SessionMode', props: { modes: [] } } as const
const CLES_PIED = new Set(['relais', 'plume', 'revenir', 'reglages'])
// La bande et, sur le bureau, la ligne des boutons, lues et pressées comme un seul dessin.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function monter($: any, surface: 'terminal' | 'desktop') {
  const bande = await $.ui.mount({ plugin: 'pupitre', surface, ...BANDE })
  const pied = surface === 'desktop' ? await $.ui.mount({ plugin: 'pupitre', surface, ...PIED }) : null
  const tous = pied ? [bande, pied] : [bande]
  return {
    drawn: async () => Promise.all(tous.map(u => u.drawn())),
    findAll: async (q: { type: string }) => (await Promise.all(tous.map(u => u.findAll(q)))).flat(),
    find: async (q: { type: string; text?: string }) => (await Promise.all(tous.map(u => u.find(q)))).find(x => x !== undefined),
    press: (t: { key: string }) => (pied && CLES_PIED.has(t.key) ? pied : bande).press(t),
    unmount: async () => { for (const u of tous) await u.unmount() },
  }
}

test('sur le bureau, relais, plume et Réglages sont dans la barre du bas, en mots courts (24 caractères de large au plus)', async ($, on) => {
  await preparer($, on)
  const bande = await $.ui.mount({ plugin: 'pupitre', surface: 'desktop', ...BANDE })
  const pied = await $.ui.mount({ plugin: 'pupitre', surface: 'desktop', ...PIED })
  expect(await libelles(bande)).toEqual([]) // la bande ne les porte plus
  expect(await libelles(pied)).toEqual(['⇄ Relais', 'Améliorer', '⚙'])
  expect((await libelles(pied)).join('').length).toBeLessThanOrEqual(19) // avec le tour de chaque pastille, tient dans 24
  await pied.press({ key: 'reglages' })
  expect(JSON.stringify(await bande.drawn())).toContain('Tout éteindre') // les réglages s'ouvrent dans la bande
  await bande.unmount()
  await pied.unmount()
  const avecMode = await $.ui.mount({ plugin: 'pupitre', surface: 'desktop', component: 'SessionMode', props: { modes: ['focus'] } })
  expect(JSON.stringify(await avecMode.drawn())).toContain('focus') // le mode du moteur reste, devant les boutons
  await avecMode.unmount()
  const terminal = await $.ui.mount({ plugin: 'pupitre', surface: 'terminal', ...PIED })
  expect(JSON.stringify(await terminal.drawn())).toContain('(bande du moteur)') // au terminal, la place reste au moteur
  await terminal.unmount()
})

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

test('travail fini : la barre passe au vert avec une croix « Fermer », qui la retire tout de suite', async ($, on) => {
  const horloge = await preparer($, on)
  await $.turn.start({ text: 'fais ceci', turnId: 't1' } as never)
  await $.tool.call({ tool: 'Read', input: { file_path: 'README.md' } })
  await $.tool.call({ tool: 'Read', input: { file_path: 'a.md' }, agentId: 'a1' } as never)
  const ui = await $.ui.mount({ plugin: 'pupitre', surface: 'desktop', ...BANDE })
  const croix = async () => (await ui.findAll({ type: 'Button' })).filter(b => b.key === 'fermer-fil')
  expect(await croix()).toHaveLength(0) // pas pendant le travail
  await $.turn.complete({ answer: '', durationMs: 5000, isAborted: false, turnId: 't1', reason: 'answer' } as never)
  await horloge.advance(4_000)
  const avant = JSON.stringify(await ui.drawn())
  expect(avant).toContain('fais ceci') // la demande sert de titre
  expect(avant).toContain('Sous-agent')
  expect(avant).not.toContain('Autres discussions') // ta conversation seule : pas de titre
  expect(avant).not.toContain('⧉')
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

// Une autre discussion en cours, et les fiches que l'application de bureau garde de chaque conversation (identifiant
// du bureau « local_… » et identifiant du moteur) ; rend les commandes lancées et les notifications.
async function autreDiscussion($: any, on: any, fichesBureau: Record<string, { sessionId: string; cliSessionId: string }>) {
  const liens: string[] = [] // les adresses ouvertes
  const toasts: string[] = []
  on('process.run', async ($: unknown, e: { argv: string[]; init?: { env?: Record<string, string> } }) => { const lien = e.init?.env?.PUPITRE_LIEN; if (lien) liens.push(lien); return { value: { exitCode: 0, stdout: '', stderr: '' } } as never })
  on('ui.toast', async ($: unknown, e: { text: string }) => { toasts.push(e.text); return { value: undefined } as never })
  mock.env(on, { OS: 'Windows_NT', USERPROFILE: 'C:/Users/essai', APPDATA: 'C:/Users/essai/AppData/Roaming' })
  const horloge = mock.clock(on, { now: 1_000_000 })
  const L: LigneFil = { id: 'claude', qui: 'Passer au design', tache: 'En cours', mot: 'Web', compteur: '≈', progression: 0.3, avant: 0, niveau: 1, niveauAvant: 1, fini: false, eclat: false, attente: false, debut: horloge.now(), majLe: horloge.now(), finiLe: null }
  const fiche = JSON.stringify(ficheDe('moteur-autre', 'Atelier', L, horloge.now()))
  const bureau = 'C:/Users/essai/AppData/Roaming/Claude/claude-code-sessions'
  on('fs.write', async () => ({ value: undefined }) as never)
  on('fs.list', async ($: unknown, e: { path: string }) => {
    const p = e.path.replace(/\\/g, '/')
    const entree = (name: string, kind: string) => ({ name, kind, size: 10, mtimeMs: horloge.now(), isLink: false })
    if (p.endsWith('/pupitre/sessions')) return { value: [entree('autre.json', 'file')] } as never
    if (p === bureau) return { value: [entree('compte', 'dir')] } as never
    if (p === `${bureau}/compte`) return { value: [entree('org', 'dir')] } as never
    if (p === `${bureau}/compte/org`) return { value: Object.keys(fichesBureau).map(n => entree(n, 'file')) } as never
    throw new Error('absent')
  })
  on('fs.read', async ($: unknown, e: { path: string }) => {
    const nom = e.path.replace(/\\/g, '/').split('/').pop()!
    return { value: nom === 'autre.json' ? fiche : JSON.stringify(fichesBureau[nom]) } as never
  })
  on('session.start', async (_: unknown, e: { cwd: string }) => ({ cwd: e.cwd }))
  on('command.register', async () => ({ value: undefined }) as never)
  on('session.id', async () => ({ value: 'moi' }) as never)
  on('session.cwd', async () => ({ value: 'C:/Users/essai/ici' }) as never)
  on('session.usage', async () => ({ value: { context: { window: 200_000 }, rateLimits: [] } }) as never)
  mock.store(on)
  on('ui.render', async () => ({ type: 'Text', props: {}, children: ['(bande du moteur)'] }) as never)
  await $.command.run({ command: 'pupitre', args: '' })
  await $.session.start({ cwd: 'C:/Users/essai/ici', surface: 'desktop', isInteractive: true })
  await horloge.advance(2_000)
  return { liens, toasts }
}

// Vérifié sur le bureau le 13/10/2026 : claude://code/continue?session=local_… bascule l'application sur la conversation.
test('autre discussion : un clic sur son titre bascule l application de bureau sur cette conversation', async ($, on) => {
  const { liens, toasts } = await autreDiscussion($, on, {
    'local_premiere.json': { sessionId: 'local_premiere', cliSessionId: 'quelqu-un-d-autre' },
    'local_1234abcd-5678.json': { sessionId: 'local_1234abcd-5678', cliSessionId: 'moteur-autre' }, // le bureau a son propre identifiant
  })
  const ui = await $.ui.mount({ plugin: 'pupitre', surface: 'desktop', ...BANDE })
  const titre = (await ui.findAll({ type: 'Button' })).find(b => b.key === 'ouvrir-moteur-autre')!
  expect(titre.props.label).toBe('Passer au design · Atelier')
  expect(titre.props.plain).toBe(true) // l'aspect d'un titre, pas d'un bouton
  await ui.press({ key: 'ouvrir-moteur-autre' })
  expect(liens).toEqual(['claude://code/continue?session=local_1234abcd-5678'])
  expect(toasts.filter(t => t.includes('discussion'))).toEqual([]) // ni « ne s'ouvre pas », ni « n'a pas pu »
  await ui.unmount()
})

test('autre discussion : sans fiche du bureau qui convienne, rien n est lancé et une notification le dit', async ($, on) => {
  const { liens, toasts } = await autreDiscussion($, on, {
    'local_x.json': { sessionId: "local_x'; Remove-Item", cliSessionId: 'moteur-autre' }, // un identifiant qui n'en est pas un
  })
  const ui = await $.ui.mount({ plugin: 'pupitre', surface: 'desktop', ...BANDE })
  await ui.press({ key: 'ouvrir-moteur-autre' })
  expect(liens).toEqual([])
  expect(toasts.some(t => t.includes('ne s'))).toBe(true)
  await ui.unmount()
})

test('autre discussion finie : sa ligne reste quelques secondes avec sa croix, même l autre discussion fermée, puis s efface', async ($, on) => {
  let fiche = ''
  let ecriteLe = 0
  const ecrits: string[] = []
  on('state.set', async ($, e, next) => { ecrits.push(String(e.key)); return next(e) })
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
  const L: LigneFil = { id: 'claude', qui: 'Claude', tache: 'En cours', mot: 'Lecture', compteur: '≈', progression: 0.3, avant: 0, niveau: 1, niveauAvant: 1, fini: false, eclat: false, attente: false, debut: horloge.now(), majLe: horloge.now(), finiLe: null }
  const poser = (l: LigneFil) => { ecriteLe = horloge.now(); fiche = JSON.stringify(ficheDe('autre', 'Atelier', l, ecriteLe)) }
  poser(L)
  await horloge.advance(2_000)
  const ui = await $.ui.mount({ plugin: 'pupitre', surface: 'desktop', ...BANDE })
  const croix = async () => (await ui.findAll({ type: 'Button' })).filter(b => b.key === 'fermer-autre')
  const enCours = JSON.stringify(await ui.drawn())
  expect(enCours).toContain('Atelier')
  expect(enCours).toContain('Autres discussions') // le titre, au-dessus des autres conversations
  expect(enCours).toContain('"⧉"') // et leur icône de fenêtre
  expect(await croix()).toHaveLength(0) // pas pendant le travail
  ecrits.length = 0
  poser(L) // son signe de vie : la même fiche, réécrite à une autre heure
  await horloge.advance(2_000)
  expect(ecrits).not.toContain('autres') // rien n'a changé à l'écran : la bande n'est pas redessinée
  poser({ ...L, mot: 'Écriture' })
  await horloge.advance(2_000)
  expect(ecrits).toContain('autres')
  const finir = () => poser({ ...L, fini: true, finiLe: horloge.now(), tache: 'Terminé', compteur: '✓', mot: '✓ Fini', progression: 1, niveau: 3 })
  finir()
  await horloge.advance(2_000)
  fiche = '' // l'autre discussion se ferme
  await horloge.advance(2_000) // 4 s après la fin
  const reste = JSON.stringify(await ui.drawn())
  expect(reste).toContain('Atelier')
  expect(reste).toContain('100 %')
  expect(reste).toContain('"color":"#2F7A3B"') // une fiche finie d'une version précédente (niveau 3) reste verte
  const [x] = await croix()
  expect(x!.props.label).toBe('×')
  await ui.press({ key: 'fermer-autre' })
  expect(JSON.stringify(await ui.drawn())).not.toContain('Atelier')
  // une nouvelle demande là-bas : sans clic, sa ligne finie s'efface toute seule 5 s après la fin
  poser({ ...L, debut: horloge.now() })
  await horloge.advance(2_000)
  expect(JSON.stringify(await ui.drawn())).toContain('Atelier')
  finir()
  await horloge.advance(4_000)
  expect(JSON.stringify(await ui.drawn())).toContain('Atelier')
  await horloge.advance(2_000)
  const vide = JSON.stringify(await ui.drawn())
  expect(vide).not.toContain('Atelier')
  expect(vide).not.toContain('Autres discussions') // plus d'autre conversation : plus de titre
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

test('Claude t attend : la barre passe à l orange avec « Ta réponse ? » et un « ? », jusqu à ta réponse', async ($, on) => {
  let repondre!: () => void
  const repondu = new Promise<void>(r => { repondre = r })
  let poser!: () => void
  const posee = new Promise<void>(r => { poser = r })
  mock.store(on)
  mock.clock(on, { now: 1_000_000 })
  on('tool.call', async ($, e) => { if (e.tool === 'AskUserQuestion') { poser(); await repondu } return { result: { text: 'ok' } } as never })
  on('turn.start', async () => ({ turnId: 't1' }))
  on('ui.render', async () => ({ type: 'Text', props: {}, children: ['(bande du moteur)'] }) as never)
  await $.command.run({ command: 'pupitre', args: '' })
  await $.turn.start({ text: 'fais ceci', turnId: 't1' } as never)
  const question = $.tool.call({ tool: 'AskUserQuestion', input: { questions: [] } } as never)
  await posee
  for (const surface of ['desktop', 'terminal'] as const) {
    const ui = await $.ui.mount({ plugin: 'pupitre', surface, ...BANDE })
    const texte = JSON.stringify(await ui.drawn())
    expect(texte).toContain('Ta réponse ?')
    expect(texte).toContain('"color":"#D6761E","wrap":"truncate"},"children":["?"]') // l'icône
    if (surface === 'desktop') expect(texte).toContain('class=\\"p\\"') // l'impulsion
    await ui.unmount()
  }
  repondre()
  await question
  const ui = await $.ui.mount({ plugin: 'pupitre', surface: 'desktop', ...BANDE })
  expect(JSON.stringify(await ui.drawn())).not.toContain('Ta réponse ?')
  await ui.unmount()
})

const images = async (ui: { findAll: (q: { type: string }) => Promise<{ props: Record<string, unknown> }[]> }) => ui.findAll({ type: 'Svg' })

test('chaque image porte l heure de son dessin, même inchangée : le bureau recrée toutes les images à chaque redessin', async ($, on) => {
  const horloge = await preparer($, on)
  await $.tool.call({ tool: 'Read', input: { file_path: 'README.md' } })
  await horloge.advance(2_500)
  const ui = await $.ui.mount({ plugin: 'pupitre', surface: 'desktop', ...BANDE })
  const svgs = await images(ui)
  expect(svgs.length).toBe(4)
  for (const s of svgs) expect(String(s.props.source)).toContain('--t:-1002.50s')
  await ui.unmount()
  // une seconde plus tard, la bande est redessinée : les images, inchangées, gardent leur dessin mais prennent la
  // nouvelle heure, sinon le temps de l'étiquette repartirait de celle du premier dessin
  await horloge.advance(1_000)
  const apres = await $.ui.mount({ plugin: 'pupitre', surface: 'desktop', ...BANDE })
  const sansHeure = (s: unknown) => String(s).replace(/svg\{[^}]*\}/, '')
  for (const s of await images(apres)) expect(String(s.props.source)).toContain('--t:-1003.50s')
  expect((await images(apres)).map(s => sansHeure(s.props.source))).toEqual(svgs.map(s => sansHeure(s.props.source)))
  await apres.unmount()
})

// Le bureau reconstruit toute la bande à chaque redessin, boutons compris (lu dans son code le 12/10/2026) : un bouton
// recréé sous la souris clignote, et un clic à cheval sur deux dessins se perd.
test('pendant le travail, la bande n est pas redessinée chaque seconde sur le bureau, seulement quand le temps change une image ; au terminal, si', async ($, on) => {
  const ecrits: string[] = [] // chaque écriture d'une valeur que la bande lit la redessine
  on('state.set', async ($, e, next) => { ecrits.push(String(e.key)); return next(e) })
  const { horloge } = await demarrer($, on)
  await $.turn.start({ text: 'fais ceci', turnId: 't1' } as never)
  // deux tâches, aucune faite : la barre ne bouge pas avec le temps
  await $.tool.call({ tool: 'TodoWrite', todos: [{ content: 'a', status: 'in_progress' }, { content: 'b', status: 'pending' }] } as never)
  const ui = await $.ui.mount({ plugin: 'pupitre', surface: 'desktop', ...BANDE })
  await horloge.advance(2_000)
  ecrits.length = 0
  await horloge.advance(5_000)
  expect(ecrits.filter(k => k === 'lignes' || k === 'maintenant')).toEqual([]) // rien n'a changé à l'écran : rien n'est redessiné
  await horloge.advance(15_000) // 20 s sans changement : la barre s'assoupit
  expect(ecrits.filter(k => k === 'lignes' || k === 'maintenant')).toEqual(['maintenant']) // un seul redessin
  expect(JSON.stringify(await ui.drawn())).toContain('class=\\"z\\"')
  await ui.unmount()
  const terminal = await $.ui.mount({ plugin: 'pupitre', surface: 'terminal', ...BANDE })
  ecrits.length = 0
  await horloge.advance(3_000)
  expect(ecrits.filter(k => k === 'maintenant')).toHaveLength(3) // au terminal, le temps est du texte : redessiné chaque seconde
  await terminal.unmount()
  ecrits.length = 0
  await horloge.advance(30_000)
  expect(ecrits).not.toContain('mesures') // la jauge relue toutes les 30 s, inchangée : pas réécrite
})

// Sur l'application, ce qu'un mod ajoute au prompt système n'arrive pas à Claude (vu à l'essai du relais) :
// la consigne entière part donc dans le message.
test('relais : la demande part toute seule, consigne entière dans le message', async ($, on) => {
  const envoyes: string[] = []
  on('prompt.submit', async ($, e) => { envoyes.push(e.text); return { text: e.text } as never })
  const horloge = await preparer($, on)
  const ui = await monter($, 'desktop')
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
  on('prompt.read', async () => ({ value: { text: '', cursor: 0 } }) as never) // zone de texte vide
  on('prompt.fill', async ($, e) => { remplis.push(e.text); return { isFilled: true } as never })
  const horloge = await preparer($, on)
  const ui = await monter($, 'desktop')
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

const svgFil = async (ui: { findAll: (q: { type: string }) => Promise<{ key?: string; props: Record<string, unknown> }[]> }) =>
  (await images(ui)).filter(x => !/^(Contexte|Limite)/.test(String(x.props.alt)))

test('le temps est toujours dans l étiquette : il tourne seul pendant le travail, s arrête à 100 %, plus de colonne à droite', async ($, on) => {
  const horloge = await preparer($, on)
  await $.turn.start({ text: 'fais ceci', turnId: 't1' } as never)
  await $.tool.call({ tool: 'Read', input: { file_path: 'README.md' } })
  await horloge.advance(2_000)
  const ui = await $.ui.mount({ plugin: 'pupitre', surface: 'desktop', ...BANDE })
  const barre = async () => String((await ui.findAll({ type: 'Svg' })).find(s => String(s.props.alt).startsWith('fais ceci'))!.props.source)
  expect(await barre()).toContain('>Lecture ·<')
  expect(await barre()).toContain('class="roule10"')
  expect(JSON.stringify(await ui.drawn())).not.toContain('"hover"') // ni bulle ni survol
  expect((await ui.findAll({ type: 'Text' })).some(t => JSON.stringify(t).includes('"0:02"'))).toBe(false) // plus de compteur à droite
  const terminal = await $.ui.mount({ plugin: 'pupitre', surface: 'terminal', ...BANDE })
  expect(JSON.stringify(await terminal.drawn())).toContain('Lecture · 0:02')
  await terminal.unmount()
  await $.turn.complete({ answer: '', durationMs: 2000, isAborted: false, turnId: 't1', reason: 'answer' } as never)
  expect(await barre()).toContain('✓ Fini · 0:02')
  expect(await barre()).not.toContain('roule')
  await ui.unmount()
})

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
  const ui = await monter($, 'desktop')
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

test('une barre finie s efface toute seule 5 s après être passée au vert, même un sous-agent pendant que Claude travaille', async ($, on) => {
  const { horloge } = await demarrer($, on)
  await $.turn.start({ text: 'fais ceci', turnId: 't1' } as never)
  await $.tool.call({ tool: 'Read', input: { file_path: 'a.md' }, agentId: 'a1' } as never)
  await $.turn.complete({ answer: '', durationMs: 2000, isAborted: false, turnId: 't1', reason: 'answer', agentId: 'a1' } as never)
  const ui = await $.ui.mount({ plugin: 'pupitre', surface: 'desktop', ...BANDE })
  await horloge.advance(4_000)
  expect(JSON.stringify(await ui.drawn())).toContain('Sous-agent')
  await horloge.advance(2_000)
  let texte = JSON.stringify(await ui.drawn())
  expect(texte).not.toContain('Sous-agent')
  expect(texte).toContain('fais ceci') // Claude travaille encore : sa barre en cours reste
  await horloge.advance(60_000)
  expect(JSON.stringify(await ui.drawn())).toContain('fais ceci') // une barre en cours ne part jamais
  await $.turn.complete({ answer: '', durationMs: 5000, isAborted: false, turnId: 't1', reason: 'answer' } as never)
  await horloge.advance(4_000)
  expect(JSON.stringify(await ui.drawn())).toContain('fais ceci')
  await horloge.advance(2_000)
  texte = JSON.stringify(await ui.drawn())
  expect(texte).not.toContain('fais ceci')
  expect(texte).toContain('Contexte') // la jauge reste
  await ui.unmount()
})

test('la jauge serrée : un trait entre ses éléments, et plus de cache, même après une réponse', async ($, on) => {
  await preparer($, on)
  await $.turn.start({ text: 'fais ceci', turnId: 't1' } as never)
  await $.turn.complete({ answer: '', durationMs: 2000, isAborted: false, turnId: 't1', reason: 'answer', usage: { model: 'm', input_tokens: 10, cache_read_input_tokens: 82, cache_creation_input_tokens: 8, output_tokens: 5 } } as never)
  for (const surface of ['desktop', 'terminal'] as const) for (const colonnes of [120, 60]) {
    const ui = await $.ui.mount({ plugin: 'pupitre', surface, component: 'AbovePrompt', props: { ...BANDE.props, bodyColumns: colonnes } })
    const texte = JSON.stringify(await ui.drawn())
    const jauge = ((await ui.drawn()) as unknown as { children: unknown[] }).children.map(c => JSON.stringify(c)).find(r => r.includes('Contexte'))!
    expect(jauge.match(/"│"/g)).toHaveLength(2) // un trait entre chaque élément
    expect(jauge).not.toContain('space-between') // serrée, plus étalée sur toute la largeur
    expect(texte).not.toContain('Cache') // retiré le 14/10/2026 : l'information n'était pas utile
    await ui.unmount()
  }
})

const mesurer = (pct: number) => ({ context: { tokens: pct * 10, window: 1000, percent: pct }, rateLimits: [], changed: ['context'] }) as never

test('relais au bon moment : au-delà du seuil, le bouton affiche le contexte et une notification prévient une fois', async ($, on) => {
  const toasts: string[] = []
  on('ui.toast', async ($, e) => { toasts.push(e.text); return { value: undefined } as never })
  on('session.measure', async ($, e) => ({ changed: e.changed }) as never)
  await preparer($, on)
  await $.session.measure(mesurer(55))
  const ui = await monter($, 'terminal') // sur le bureau, la barre du bas dit « Relais », sans le contexte
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
  const ui = await monter($, 'desktop')
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
  on('prompt.read', async () => ({ value: { text: '', cursor: 0 } }) as never) // zone de texte vide
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
  const ui = await monter($, 'desktop')
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
  const ui = await monter($, 'desktop')
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
  const ui = await monter($, 'desktop')
  await ui.press({ key: 'plume' })
  expect(boite).toBe('refais-les plus jolies, et vite')
  expect(toasts.some(t => t.includes('changé'))).toBe(true)
  expect(await libelles(ui)).toContain('Améliorer')
  await ui.unmount()
})

test('« Améliorer le prompt » : un modèle qui refuse l appel ne bloque pas le bouton', async ($, on) => {
  const toasts: string[] = []
  on('prompt.read', async () => ({ value: { text: 'refais-les', cursor: 10 } }) as never)
  on('ui.toast', async ($, e) => { toasts.push(e.text); return { value: undefined } as never })
  on('model.complete', async () => { throw new Error('modèle non autorisé') })
  await preparer($, on)
  const ui = await monter($, 'desktop')
  await ui.press({ key: 'plume' })
  expect(toasts.some(t => t.includes('Amélioration impossible'))).toBe(true)
  expect(await libelles(ui)).toContain('Améliorer')
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
  const ui = await monter($, 'desktop')
  expect(await libelles(ui)).toEqual(['⇄ Relais', 'Améliorer', '⚙'])
  await ui.unmount()
})

test('carillon : sous Windows, c est PowerShell qui joue le son du mod (le moteur n y joue rien)', async ($, on) => {
  mock.env(on, { OS: 'Windows_NT', USERPROFILE: 'C:/Users/essai' })
  const lances: string[] = []
  const sons: (string | undefined)[] = []
  on('process.run', async ($, e) => { lances.push(e.argv.join(' ')); sons.push(e.init?.env?.PUPITRE_SON); return { value: { exitCode: 0, stdout: '', stderr: '' } } as never })
  await preparer($, on)
  await $.turn.start({ text: 'fais ceci', turnId: 't1' } as never)
  await $.turn.complete({ answer: '', durationMs: 31_000, isAborted: false, turnId: 't1', reason: 'answer' } as never)
  expect(lances).toHaveLength(1)
  expect(lances[0]).toContain('powershell')
  expect(lances[0]).not.toContain('carillon.wav') // le chemin passe à part : une apostrophe ne casse pas la commande
  expect(sons[0]).toMatch(/assets\/carillon\.wav$/)
})

test('relais : un brouillon tapé pendant le relais n est jamais écrasé', async ($, on) => {
  const remplis: string[] = []
  const toasts: string[] = []
  const commandes: string[] = []
  on('prompt.submit', async () => ({ drop: 'session occupée' }) as never)
  on('prompt.read', async () => ({ value: { text: 'mon brouillon', cursor: 13 } }) as never)
  on('prompt.fill', async ($, e) => { remplis.push(e.text); return { isFilled: true } as never })
  on('ui.toast', async ($, e) => { toasts.push(e.text); return { value: undefined } as never })
  on('command.run', { command: 'clear' }, async () => { commandes.push('clear'); return { text: '' } as never })
  on('session.root', async () => ({ value: 'C:/projet' }) as never)
  on('fs.stat', async () => ({ value: { kind: 'file', size: 10, mtimeMs: 2_000_000_000_000, isLink: false } }) as never)
  const horloge = await preparer($, on)
  const ui = await monter($, 'desktop')
  await ui.press({ key: 'relais' })
  await horloge.advance(10)
  await $.turn.start({ text: `${DEBUT_RELAIS} à la racine du projet`, turnId: 't2' } as never)
  await $.turn.complete({ answer: '', durationMs: 1000, isAborted: false, turnId: 't2', reason: 'answer' } as never)
  await horloge.advance(400)
  expect(commandes).toEqual(['clear']) // le relais est allé au bout
  expect(remplis).toEqual([]) // ni la demande refusée, ni « Lis relais.md » ne remplacent le brouillon
  expect(toasts.some(t => t.includes('Lis relais.md'))).toBe(true)
  await ui.unmount()
})

for (const [nom, env] of [['Windows', { OS: 'Windows_NT', USERPROFILE: 'C:/Users/essai' }], ['macOS', { HOME: '/Users/essai' }]] as const) {
  test(`au démarrage, les fiches partagées de plus d une heure sont effacées (${nom})`, async ($, on) => {
    const lances: { argv: readonly string[]; env?: Readonly<Record<string, string>> }[] = []
    mock.env(on, env)
    on('process.run', async ($, e) => { lances.push({ argv: e.argv, env: e.init?.env }); return { value: { exitCode: 0, stdout: '', stderr: '' } } as never })
    on('session.start', async (_: unknown, e: { cwd: string }) => ({ cwd: e.cwd }))
    on('command.register', async () => ({ value: undefined }) as never)
    on('session.id', async () => ({ value: 'moi' }) as never)
    on('session.cwd', async () => ({ value: 'C:/Users/essai/ici' }) as never)
    on('session.usage', async () => ({ value: { context: { window: 200_000 }, rateLimits: [] } }) as never)
    const horloge = await preparer($, on)
    await $.session.start({ cwd: 'C:/Users/essai/ici', surface: 'desktop', isInteractive: true })
    await horloge.advance(0)
    const dossier = `${'USERPROFILE' in env ? env.USERPROFILE : env.HOME}/.claude/pupitre/sessions`
    expect(lances).toHaveLength(1)
    if (nom === 'Windows') {
      expect(lances[0]!.argv[0]).toBe('powershell.exe')
      expect(lances[0]!.argv.join(' ')).toContain('AddHours(-1)')
      expect(lances[0]!.env?.PUPITRE_FICHES).toBe(dossier)
    } else {
      expect(lances[0]!.argv).toEqual(['find', dossier, '-name', '*.json', '-mmin', '+60', '-delete'])
    }
  })
}

test('« Améliorer le prompt » : réécrit avec la conversation, et « Revenir à mon texte » reste jusqu à l envoi', async ($, on) => {
  const demandes: string[] = []
  let boite = 'refais-les plus jolies'
  on('prompt.read', async () => ({ value: { text: boite, cursor: boite.length } }) as never)
  on('prompt.fill', async ($, e) => { boite = e.text; return { isFilled: true } as never })
  on('session.messages', async () => ({ value: [{ role: 'user', text: 'parle-moi des barres', toolUses: [] }, { role: 'assistant', text: 'Voici les barres du fil.', toolUses: [] }] }) as never)
  on('model.complete', async ($, e) => { demandes.push(e.prompt); return { value: { isAnswered: true, text: 'Rends les barres du fil plus jolies.', usage: {} } } as never })
  on('prompt.submit', async ($, e) => ({ text: e.text }) as never)
  const horloge = await preparer($, on)
  const ui = await monter($, 'desktop')
  await ui.press({ key: 'plume' })
  expect(demandes[0]).toContain('Voici les barres du fil.')
  expect(boite).toBe('Rends les barres du fil plus jolies.')
  await horloge.advance(120_000) // le temps de relire : le retour reste possible
  expect(await libelles(ui)).toContain('Retour')
  await $.prompt.submit({ text: boite })
  expect(await libelles(ui)).toContain('Améliorer')
  await ui.unmount()
})

const libelles = async (ui: { findAll: (q: { type: string }) => Promise<{ props: Record<string, unknown> }[]> }) =>
  (await ui.findAll({ type: 'Button' })).map(b => String(b.props.label))

test('« Réglages » déplie une ligne avec un bouton par fonction, puis se replie', async ($, on) => {
  await preparer($, on)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await monter($, surface)
    const fermes = surface === 'desktop' ? ['⇄ Relais', 'Améliorer', '⚙'] : ['Passer le relais', 'Améliorer le prompt', 'Réglages']
    expect(await libelles(ui)).toEqual(fermes)
    await ui.press({ key: 'reglages' })
    const ouverts = await libelles(ui)
    for (const l of ['✓ Jauge', '✓ Fil', '✓ Relais', '✓ Plume', '✓ Cap', 'Tout éteindre', 'Replier', '−', '+', '○ Automatique']) expect(ouverts).toContain(l)
    expect(JSON.stringify(await ui.drawn())).toContain('Relais à :')
    await ui.press({ key: 'replier' })
    expect(await libelles(ui)).toEqual(fermes)
    await ui.unmount()
  }
})

test('un bouton de réglage éteint puis rallume sa fonction', async ($, on) => {
  await preparer($, on)
  const ui = await monter($, 'desktop')
  await ui.press({ key: 'reglages' })
  await ui.press({ key: 'basculer-jauge' })
  expect(await libelles(ui)).toContain('○ Jauge')
  expect(await libelles(ui)).toContain('Tout allumer')
  expect(JSON.stringify(await ui.drawn())).not.toContain('Contexte')
  await ui.press({ key: 'basculer-relais' })
  expect(await libelles(ui)).not.toContain('⇄ Relais')
  await ui.press({ key: 'basculer-jauge' })
  expect(JSON.stringify(await ui.drawn())).toContain('Contexte')
  await ui.unmount()
})

test('« Réglages » reste accessible quand seul le fil est allumé', async ($, on) => {
  await preparer($, on)
  for (const command of ['jauge', 'relais', 'plume']) await $.command.run({ command, args: '' })
  const ui = await monter($, 'desktop')
  expect(await libelles(ui)).toEqual(['⚙']) // sur le bureau, la roue de la barre du bas
  await ui.unmount()
})

test('« Tout éteindre » retire la bande', async ($, on) => {
  await preparer($, on)
  const ui = await monter($, 'desktop')
  await ui.press({ key: 'reglages' })
  await ui.press({ key: 'tout' })
  expect(await ui.find({ type: 'Button', key: 'reglages' })).toBeUndefined()
  await ui.unmount()
})

const BOUCLES = /class="(e|r|v|c|h\d)"/ // étincelles, bande de lumière, pixels qui fuient, battement, tête qui clignote
const sources = async (ui: { findAll: (q: { type: string }) => Promise<{ props: Record<string, unknown> }[]> }) =>
  (await ui.findAll({ type: 'Svg' })).map(s => String(s.props.source))

// Une session qui démarre avec, sur le disque, ce que `store` contient ; rend son horloge, et de quoi en démarrer une autre.
async function demarrer($: any, on: any, store: Record<string, unknown> = {}) {
  mock.store(on, store)
  const horloge = mock.clock(on, { now: 1_000_000 })
  on('tool.call', async () => ({ result: { text: 'contenu' } }) as never)
  on('turn.start', async () => ({ turnId: 't1' }))
  on('turn.complete', async () => ({ text: '' }))
  mock.env(on, { USERPROFILE: 'C:/Users/essai' })
  on('session.start', async (_: unknown, e: { cwd: string }) => ({ cwd: e.cwd }))
  on('command.register', async () => ({ value: undefined }) as never)
  on('session.id', async () => ({ value: 'moi' }) as never)
  on('session.cwd', async () => ({ value: 'C:/Users/essai/ici' }) as never)
  // contexte à 40 % : une jauge remplie, où passe la bande de lumière
  on('session.usage', async () => ({ value: { context: { window: 200_000, tokens: 80_000 }, rateLimits: [] } }) as never)
  on('ui.render', async () => ({ type: 'Text', props: {}, children: ['(bande du moteur)'] }) as never)
  const relancer = () => $.session.start({ cwd: 'C:/Users/essai/ici', surface: 'desktop', isInteractive: true })
  await relancer()
  return { horloge, relancer }
}

test('« Animations » réduites : les jauges ne tournent plus en boucle, et le choix est gardé pour la session suivante', async ($, on) => {
  const { relancer } = await demarrer($, on)
  const ui = await monter($, 'desktop')
  expect((await sources(ui)).some(s => BOUCLES.test(s))).toBe(true)
  await ui.press({ key: 'reglages' })
  expect(JSON.stringify(await ui.drawn())).toContain('Animations :')
  for (const l of ['✓ Complètes', '○ Réduites', '○ Coupées']) expect(await libelles(ui)).toContain(l)
  await ui.press({ key: 'animations-reduites' })
  expect(await libelles(ui)).toContain('✓ Réduites')
  expect(await libelles(ui)).toContain('○ Complètes')
  const apres = await sources(ui)
  expect(apres.length).toBe(3)
  for (const s of apres) expect(s).not.toMatch(BOUCLES)
  await ui.press({ key: 'replier' })
  await ui.unmount()
  await relancer() // la session suivante relit le réglage sur le disque
  const ensuite = await monter($, 'desktop')
  await ensuite.press({ key: 'reglages' })
  expect(await libelles(ensuite)).toContain('✓ Réduites')
  await ensuite.unmount()
})

test('« Animations » n apparaît que là où les barres sont des images, pas au terminal', async ($, on) => {
  await preparer($, on)
  for (const [surface, visible] of [['terminal', false], ['desktop', true]] as const) {
    const ui = await monter($, surface)
    await ui.press({ key: 'reglages' })
    expect(JSON.stringify(await ui.drawn()).includes('Animations :')).toBe(visible)
    await ui.press({ key: 'replier' })
    await ui.unmount()
  }
})

test('« Animations » : coupées, enregistré avant le démarrage, s applique tout de suite', async ($, on) => {
  await demarrer($, on, { animations: 'coupees' })
  const ui = await monter($, 'desktop')
  for (const s of await sources(ui)) expect(s).not.toMatch(BOUCLES)
  await ui.press({ key: 'reglages' })
  expect(await libelles(ui)).toContain('✓ Coupées')
  await ui.unmount()
})

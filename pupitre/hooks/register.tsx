import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Animations, Autre, LigneFil, Mesures, Plume, ReglageRelais, Reglages } from '../types'
import { AUCUN, basculer, changerSeuil, jaugeVisible, lireAnimations, lireRelais, lireReglages, type Commande } from './reglages'
import { MESURES_VIDES, lireMesures, pourcentageCache, type UsageLu } from './jauge'
import { dessinerBande, dessinerBoutons, piedDe, type Bouton, type Elements, type Pied } from './bande'
import { appliquerAppel, debutTour, encoreVisible, etape, finir, ligneDe, lignesGardees, nouveauSuivi, type Suivi } from './fil'
import { CONSIGNE_CAP_AUTO, CONSIGNE_FIL, DEBUT_RELAIS, REPRISE_RELAIS, consigneRelais, SYSTEME_PLUME, contexteRecent, explicationCache, messageHumain, nettoyerReponse, promptPlume, relaisEcrit, type Capacite } from './textes'
import { PERIME_MS, ficheDe, lireFiche, nomFichier, suivreAutres, titreDe, type Fiche } from './partage'
import { palier } from './pixels'

type Dollar = EngineInterface // le `$` de chaque hook

export const reglagesA = atom({ plugin: 'pupitre', key: 'reglages' } as const, AUCUN)
export const mesuresA = atom({ plugin: 'pupitre', key: 'mesures' } as const, MESURES_VIDES as Mesures)

export const lignesA = atom({ plugin: 'pupitre', key: 'lignes' } as const, [] as LigneFil[])
export const autresA = atom({ plugin: 'pupitre', key: 'autres' } as const, [] as Autre[])
export const maintenantA = atom({ plugin: 'pupitre', key: 'maintenant' } as const, 0)
export const plumeA = atom({ plugin: 'pupitre', key: 'plume' } as const, { original: null, enCours: false } as Plume)
export const ouvertA = atom({ plugin: 'pupitre', key: 'reglagesOuverts' } as const, false)
export const chargeA = atom({ plugin: 'pupitre', key: 'charge' } as const, false)
export const relaisA = atom({ plugin: 'pupitre', key: 'relais' } as const, lireRelais(undefined) as ReglageRelais)
export const cacheA = atom({ plugin: 'pupitre', key: 'cache' } as const, null as number | null)
export const animationsA = atom({ plugin: 'pupitre', key: 'animations' } as const, 'completes' as Animations)

let derniereUsage: UsageLu | null = null

const suivis = new Map<string, Suivi>()        // 'claude' ou l'agentId
const noms = new Map<string, string>()         // agentId -> « Sous-agent n · description »
let numeroAgent = 0
// Un /clear ouvre une conversation neuve à l'état vide, sans session.start : le tic d'une seconde remet alors
// réglages et mesures, et les barres gardées à la fin de l'ancienne conversation.
let gardeClear: { lignes: LigneFil[]; autres: Autre[] } = { lignes: [], autres: [] }
let relaisDepuis: number | null = null // heure du clic sur « Passer le relais », tant que le relais est en cours
// La demande d'un mod ne part qu'au repos : cliquée en plein tour, elle tourne au tour d'après. On suit donc le tour qui
// porte la consigne, et lui seul décide de la suite.
let tourRelais: string | null = null
const RELAIS_MAX_MS = 10 * 60_000 // sans tour de relais au bout de 10 min, la consigne s'est perdue : un clic relance
let plumeEnCours = false // posé avant tout await : un double clic ne lance qu'une amélioration
const SEUIL_SON_MS = 30_000 // carillon seulement après un travail de plus de 30 s
let tourEnCours = false // turn.start ne dit pas qui démarre : on ne remet à zéro qu'au début d'un tour principal
let demandeTour = '' // le début de la demande en cours : titre de la ligne de Claude
let seuilPasse = false // le contexte a dépassé le seuil du relais : on ne prévient qu'une fois par dépassement
let enTexte = false // la bande a été dessinée en caractères (terminal) : son temps est du texte, redessiné chaque seconde
let dernierPalier = '' // ce que le temps seul changeait aux images au dernier redessin (voir palier)

async function majLignes($: Dollar): Promise<void> {
  const maintenant = await $.clock.now()
  const avant = await read($, lignesA)
  const ordre = ['claude', ...[...suivis.keys()].filter(k => k !== 'claude')]
  const lignes: LigneFil[] = []
  for (const id of ordre) {
    const s = suivis.get(id)
    if (!s) continue
    const qui = id === 'claude' ? (demandeTour || 'Claude') : (noms.get(id) ?? 'Sous-agent')
    lignes.push(ligneDe(id, qui, s, maintenant, avant.find(l => l.id === id)))
  }
  // le bureau reconstruit toute la bande à chaque écriture, boutons compris : rien n'est écrit quand rien n'a changé
  if (JSON.stringify(lignes) !== JSON.stringify(avant)) await update($, lignesA, () => lignes)
}

// court : la barre du bas du bureau, large de 24 caractères au plus (lu dans son code) : des mots courts, sans « Effacer »
async function boutonsDe($: Dollar, r: Reglages, pied: Pied, court = false): Promise<Bouton[]> {
  const boutons: Bouton[] = []
  if (!court && r.fil && pied.effacer) boutons.push({ cle: 'effacer', libelle: 'Effacer les barres finies', action: () => { void effacerFinies($) } })
  if (r.relais) boutons.push({ cle: 'relais', libelle: court ? '⇄ Relais' : pied.relais !== null ? `Passer le relais · ${pied.relais} %` : 'Passer le relais', action: () => { void lancerRelais($) } })
  const plume = await read($, plumeA)
  if (r.plume) {
    if (plume.original !== null) boutons.push({ cle: 'revenir', libelle: court ? 'Retour' : 'Revenir à mon texte', action: () => { void revenir($) } })
    else boutons.push({ cle: 'plume', libelle: plume.enCours ? (court ? 'Améliorer…' : 'Amélioration…') : (court ? 'Améliorer' : 'Améliorer le prompt'), action: () => { void ameliorer($) } })
  }
  boutons.push({ cle: 'reglages', libelle: court ? '⚙' : 'Réglages', action: () => { void update($, ouvertA, o => !o) } })
  return boutons
}

// Un brouillon tapé entre-temps n'est jamais écrasé : la zone de texte n'est remplie que vide.
async function remplirSiVide($: Dollar, texte: string): Promise<boolean> {
  if ((await $.prompt.read()).text.trim()) return false
  return (await $.prompt.fill({ text: texte, mode: 'replace' })).isFilled
}

// Envoie une demande du mod hors du hook qui l'appelle : le moteur refuse un envoi fait depuis un command.run (il
// attendrait le tour que ce hook tient). Si l'envoi échoue quand même, la demande attend dans la zone de texte.
// La consigne entière est dans le texte : le moteur retire le contexte joint à l'envoi d'un mod, et sur l'application
// les ajouts au prompt système n'arrivent pas à Claude (vu à l'essai du relais).
function envoyer($: Dollar, texte: string): void {
  $.clock.after(0, () => {
    void (async () => {
      let refus: string | undefined
      try { refus = (await $.prompt.submit({ text: texte })).drop } catch (err) { refus = String(err) }
      if (refus === undefined) return
      const isFilled = await remplirSiVide($, texte)
      $.ui.toast(isFilled ? 'Pupitre : appuie sur Entrée pour envoyer la demande.' : `Pupitre : la demande n'a pas pu partir (${refus}).`)
    })()
  })
}

async function lancerRelais($: Dollar): Promise<void> {
  const maintenant = await $.clock.now()
  if (relaisDepuis !== null && maintenant - relaisDepuis < RELAIS_MAX_MS) return
  relaisDepuis = maintenant
  tourRelais = null
  $.ui.toast('Pupitre : relais en cours…')
  let id = ''
  try { id = await $.session.id() } catch { /* sans id, relais.md n'aura pas la ligne pour rouvrir la conversation */ }
  envoyer($, consigneRelais(id))
}

// Au-delà du seuil choisi : une notification (une fois par dépassement), ou le relais lancé tout seul en automatique.
async function surveillerRelais($: Dollar): Promise<void> {
  const ctx = (await read($, mesuresA)).contexte.pct
  const { seuil, auto } = await read($, relaisA)
  if (!(await read($, reglagesA)).relais || ctx === null || ctx < seuil) { seuilPasse = false; return }
  if (seuilPasse) return
  if (auto && tourEnCours) return // en automatique, on attend la fin du tour : turn.complete relance la surveillance
  seuilPasse = true
  if (auto) await lancerRelais($)
  else $.ui.toast(`Pupitre : contexte à ${Math.round(ctx)} %, pense à passer le relais.`)
}

async function reglerRelais($: Dollar, f: (r: ReglageRelais) => ReglageRelais): Promise<void> {
  const r = f(await read($, relaisA))
  await update($, relaisA, () => r)
  await $.store.set('relais', r)
  seuilPasse = false
}

async function choisirAnimations($: Dollar, a: Animations): Promise<void> {
  await update($, animationsA, () => a)
  await $.store.set('animations', a)
}

// Réglages (gardés sur le disque) et mesures : au démarrage, et de nouveau après un /clear.
async function charger($: Dollar): Promise<void> {
  const garde = lireReglages(await $.store.get('reglages'))
  await update($, reglagesA, () => garde)
  const u = await $.session.usage()
  derniereUsage = { context: u.context, rateLimits: u.rateLimits }
  const maintenant = await $.clock.now()
  await update($, mesuresA, () => lireMesures(derniereUsage!, maintenant))
  const relais = lireRelais(await $.store.get('relais'))
  await update($, relaisA, () => relais)
  const animations = lireAnimations(await $.store.get('animations'))
  await update($, animationsA, () => animations)
  await update($, plumeA, p => ({ ...p, enCours: false })) // un rechargement en pleine amélioration ne bloque pas le bouton
  await update($, chargeA, () => true)
}

async function capacites($: Dollar): Promise<Capacite[]> {
  const out: Capacite[] = []
  try { for (const c of await $.command.list()) out.push({ sorte: 'commande', nom: c.name, description: c.description }) } catch { /* ignoré */ }
  try { for (const t of await $.tool.list()) out.push({ sorte: t.mcp ? 'connecteur' : 'outil', nom: t.name, description: t.description }) } catch { /* ignoré */ }
  try { for (const a of await $.agent.list()) out.push({ sorte: 'sous-agent', nom: a.type, description: a.description }) } catch { /* ignoré */ }
  return out
}

async function ameliorer($: Dollar): Promise<void> {
  if (plumeEnCours) return
  plumeEnCours = true
  try {
    const { text: brouillon } = await $.prompt.read()
    if (!brouillon.trim()) { $.ui.toast("Écris d'abord ta demande."); return }
    await update($, plumeA, p => ({ ...p, enCours: true }))
    let dossier = ''
    try { dossier = (await $.session.root()).split(/[\\/]/).pop() ?? '' } catch { /* dossier inconnu */ }
    let contexte = contexteRecent([], dossier)
    try { contexte = contexteRecent(await $.session.messages(), dossier) } catch { /* conversation illisible : la demande seule */ }
    // une longue demande garde la place de sa réécriture
    const demande = { system: SYSTEME_PLUME, prompt: promptPlume(brouillon, await capacites($), contexte), maxTokens: Math.min(8000, 2000 + Math.ceil(brouillon.length / 2)), timeoutMs: 60_000 }
    // un modèle refusé (liste des modèles autorisés) rejette l'appel : on passe alors au modèle de la session
    const essayer = async (modele: string | Promise<string>) => { try { return await $.model.complete({ ...demande, model: await modele }) } catch { return null } }
    let r = await essayer('sonnet')
    if (!r?.isAnswered) r = await essayer($.session.model())
    const texte = r?.isAnswered ? nettoyerReponse(r.text) : ''
    if (!texte) { $.ui.toast('Amélioration impossible : réessaie.'); return }
    if ((await $.prompt.read()).text !== brouillon) { $.ui.toast("Ta demande a changé pendant l'amélioration : rien n'est remplacé."); return }
    const fait = await $.prompt.fill({ text: texte, mode: 'replace' })
    if (!fait.isFilled) { $.ui.toast("La zone de texte n'est pas disponible."); return }
    await update($, plumeA, p => ({ ...p, original: brouillon })) // « Revenir à mon texte » jusqu'à l'envoi
  } finally {
    plumeEnCours = false
    await update($, plumeA, p => ({ ...p, enCours: false }))
  }
}

// Le moteur ne joue un son que sur macOS (afplay) ; sous Windows, il ne joue rien : PowerShell lit alors le fichier du mod.
async function carillon($: Dollar): Promise<void> {
  if ((await $.env.get('OS')) !== 'Windows_NT') return $.audio.play({ asset: 'assets/carillon.wav' })
  // le chemin passe par une variable : une apostrophe, droite ou courbe, y casserait la commande
  await $.process.run(['powershell.exe', '-NoProfile', '-NonInteractive', '-Command', '(New-Object Media.SoundPlayer $env:PUPITRE_SON).PlaySync()'], { env: { PUPITRE_SON: `${$.plugin.root}/assets/carillon.wav` } })
}

async function fermerFil($: Dollar): Promise<void> {
  if ([...suivis.values()].some(s => s.fin === null)) return // seulement une fois le travail fini
  suivis.clear()
  await majLignes($)
}

// « Effacer les barres finies » : retire toutes les barres vertes, d'ici et des autres discussions ; garde celles en cours.
async function effacerFinies($: Dollar): Promise<void> {
  for (const [k, s] of suivis) if (s.fin !== null) suivis.delete(k)
  await majLignes($)
  await update($, autresA, l => l.filter(a => a.finiLe === null))
}

// Une barre finie s'efface toute seule 5 s après être passée au vert, comme si on avait cliqué sa croix ;
// ici, comme chez les autres discussions. Une barre en cours reste.
async function effacerVieillesFinies($: Dollar, maintenant: number): Promise<void> {
  let change = false
  for (const [k, s] of suivis) if (!encoreVisible(s.fin, maintenant)) { suivis.delete(k); change = true }
  if (change || (await read($, lignesA)).some(l => !encoreVisible(l.finiLe, maintenant))) await majLignes($)
  if ((await read($, autresA)).some(a => !encoreVisible(a.finiLe, maintenant))) await update($, autresA, l => l.filter(a => encoreVisible(a.finiLe, maintenant)))
}

async function revenir($: Dollar): Promise<void> {
  const p = await read($, plumeA)
  if (p.original === null) return
  if ((await $.prompt.fill({ text: p.original, mode: 'replace' })).isFilled) await update($, plumeA, x => ({ ...x, original: null }))
}

async function nomAgent($: Dollar, agentId: string): Promise<void> {
  if (noms.has(agentId)) return
  numeroAgent += 1
  let description = ''
  try { description = (await $.agent.list()).find(a => a.id === agentId)?.description ?? '' } catch { /* liste indisponible */ }
  noms.set(agentId, `${numeroAgent} · ${description || 'Sous-agent'}`)
}

const DESCRIPTIONS: Record<Commande, string> = {
  pupitre: 'Allume tout le pupitre (ou l éteint si tout est déjà allumé)',
  jauge: 'Allume ou éteint la jauge (contexte, limites 5 h et 7 jours)',
  fil: 'Allume ou éteint les barres de progression de Claude et des sous-agents',
  relais: 'Allume ou éteint le bouton « Passer le relais »',
  plume: 'Allume ou éteint le bouton « Améliorer le prompt »',
  cap: 'Allume ou éteint le cap automatique : Claude te propose 3 suites à la fin de chaque réponse',
}

async function appliquer($: Dollar, c: Commande): Promise<{ reglages: Reglages; message: string }> {
  const r = basculer(await read($, reglagesA), c)
  await update($, reglagesA, () => r.reglages)
  await $.store.set('reglages', r.reglages)
  return r
}

async function bascule($: Dollar, c: Commande) {
  const { message } = await appliquer($, c)
  $.ui.toast(message)
  return { text: message }
}

// Bouton de la ligne « Réglages » : le libellé ✓ / ○ suffit ; un message seulement quand la bande s'en va.
async function boutonReglage($: Dollar, c: Commande): Promise<void> {
  const { reglages } = await appliquer($, c)
  if (!jaugeVisible(reglages)) {
    await update($, ouvertA, () => false)
    $.ui.toast('Pupitre : tout est éteint. Tape /pupitre pour le rallumer.')
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    // noms écrits en toutes lettres : le moteur reconnaît ainsi que ces hooks répondent à leurs propres commandes
    await $.command.register({ name: 'pupitre', description: DESCRIPTIONS.pupitre })
    await $.command.register({ name: 'jauge', description: DESCRIPTIONS.jauge })
    await $.command.register({ name: 'fil', description: DESCRIPTIONS.fil })
    await $.command.register({ name: 'relais', description: DESCRIPTIONS.relais })
    await $.command.register({ name: 'plume', description: DESCRIPTIONS.plume })
    await $.command.register({ name: 'cap', description: DESCRIPTIONS.cap })
    await charger($)
    await update($, lignesA, l => lignesGardees(l)) // suivis repart à vide : seules les barres finies (et leur croix) restent
    $.ui.invalidate('ui.render') // mod rechargé : la bande se redessine tout de suite, sans attendre un changement

    $.clock.every(30_000, () => {
      void (async () => {
        if (!derniereUsage) return
        const m = lireMesures(derniereUsage, await $.clock.now())
        // le bureau reconstruit toute la bande à chaque écriture : rien n'est écrit quand rien n'a changé
        if (JSON.stringify(m) !== JSON.stringify(await read($, mesuresA))) await update($, mesuresA, () => m)
      })()
    })
    $.clock.every(1000, () => {
      void (async () => {
        if (!(await read($, chargeA))) { // après un /clear
          await charger($)
          await update($, lignesA, () => gardeClear.lignes)
          await update($, autresA, () => gardeClear.autres)
        }
        const maintenant = await $.clock.now()
        await effacerVieillesFinies($, maintenant)
        if ((await read($, lignesA)).some(l => !l.fini)) await majLignes($)
        // Le bureau reconstruit toute la bande à chaque redessin, boutons compris (lu dans son code le 12/10/2026) : un
        // bouton recréé sous la souris clignote. Le temps tourne seul dans les images : on ne redessine que quand le temps
        // change une image (assoupie, colonne de 10 min et de 1 h), ici comme chez les autres fenêtres. Au terminal, chaque seconde.
        const enCours = [...(await read($, lignesA)).filter(l => !l.fini), ...(await read($, autresA)).filter(a => a.finiLe === null)]
        const p = enCours.map(b => palier(b, maintenant)).join()
        if (enCours.length > 0 && (enTexte || p !== dernierPalier)) { dernierPalier = p; await update($, maintenantA, () => maintenant) }
      })()
    })

    // Partage avec les autres discussions du PC : chaque session écrit sa fiche et lit celles des autres.
    const maison = (await $.env.get('USERPROFILE')) ?? (await $.env.get('HOME')) ?? ''
    const dossier = `${maison}/.claude/pupitre/sessions`
    // le mod n'a pas de quoi effacer un fichier : au démarrage, le système efface les fiches de plus d'une heure
    if (maison) void $.process.run((await $.env.get('OS')) === 'Windows_NT'
      ? ['powershell.exe', '-NoProfile', '-NonInteractive', '-Command', 'Get-ChildItem -LiteralPath $env:PUPITRE_FICHES -Filter *.json | Where-Object LastWriteTime -lt (Get-Date).AddHours(-1) | Remove-Item']
      : ['find', dossier, '-name', '*.json', '-mmin', '+60', '-delete'], { env: { PUPITRE_FICHES: dossier } }).catch(() => { /* dossier pas encore créé : rien à effacer */ })
    const moi = await $.session.id()
    const titre = titreDe(await $.session.cwd())
    let dernierEcrit = ''
    let derniereEcriture = 0
    $.clock.every(2000, () => {
      void (async () => {
        if (!maison || !(await read($, reglagesA)).fil) return
        const maintenant = await $.clock.now()
        const claude = (await read($, lignesA)).find(l => l.id === 'claude')
        const f = ficheDe(moi, titre, claude, maintenant)
        const texte = JSON.stringify({ ...f, majLe: 0 })
        // écrire si quelque chose a changé, ou toutes les 6 s tant que la session travaille (signe de vie)
        if (texte !== dernierEcrit || (f.actif && maintenant - derniereEcriture >= 6000)) {
          try { await $.fs.write(`${dossier}/${nomFichier(moi)}`, JSON.stringify(f)); dernierEcrit = texte; derniereEcriture = maintenant } catch { /* disque indisponible : on réessaiera */ }
        }
        let entrees: { name: string; mtimeMs: number }[] = []
        try { entrees = await $.fs.list(dossier) } catch { return }
        const fiches: (Fiche | null)[] = []
        for (const en of entrees.filter(x => x.name.endsWith('.json') && x.name !== nomFichier(moi) && maintenant - x.mtimeMs <= PERIME_MS).slice(0, 20)) {
          try { fiches.push(lireFiche(String(await $.fs.read(`${dossier}/${en.name}`)))) } catch { fiches.push(null) }
        }
        const suivre = (avant: readonly Autre[]) => suivreAutres(avant, fiches, moi, maintenant)
        const avant = await read($, autresA)
        // Le signe de vie d'une autre fenêtre (sa fiche réécrite toutes les 6 s) ne change que l'heure de la fiche : la
        // bande, que le bureau reconstruit en entier, n'est redessinée que pour un vrai changement. Sa barre garde ainsi
        // l'heure de son dernier changement, et s'assoupit après 20 s sans rien, comme celle d'ici.
        const sansHeure = (l: readonly Autre[]) => JSON.stringify(l.map(a => ({ ...a, majLe: 0 })))
        if (sansHeure(avant) !== sansHeure(suivre(avant))) await update($, autresA, suivre)
      })()
    })
    return next(e)
  })

  on('session.end', async ($, e, next) => {
    gardeClear = { lignes: [...await read($, lignesA)], autres: [...await read($, autresA)] }
    try {
      const maison = (await $.env.get('USERPROFILE')) ?? (await $.env.get('HOME')) ?? ''
      const moi = await $.session.id()
      if (maison) await $.fs.write(`${maison}/.claude/pupitre/sessions/${nomFichier(moi)}`, JSON.stringify(ficheDe(moi, '', undefined, await $.clock.now())))
    } catch { /* rien à faire */ }
    return next(e)
  })

  on('prompt.compose', async ($, e, next) => {
    const r = await next(e)
    if (!(await read($, reglagesA)).fil) return r
    return { ...r, sections: [...r.sections, { id: 'pupitre-fil', text: CONSIGNE_FIL, scope: 'session' as const }] }
  })

  // Cap automatique : la consigne part avec chacun de tes messages (le contexte d'un message de l'utilisateur arrive à
  // Claude ; ceux du mod lui-même, non, et une commande part telle quelle).
  on('prompt.submit', async ($, e, next) => {
    const humain = messageHumain(e.origin?.kind ?? '') // sans origine (kit de test), c'est un message de la personne
    if (humain && (await read($, plumeA)).original !== null) await update($, plumeA, p => ({ ...p, original: null })) // envoyé : plus de retour
    if (!humain || next.origin.plugin === 'pupitre' || e.text.trimStart().startsWith('/') || !(await read($, reglagesA)).cap) return next(e)
    return next({ ...e, context: [...(e.context ?? []), CONSIGNE_CAP_AUTO] })
  })

  on('turn.start', async ($, e, next) => {
    if (!tourEnCours) {
      tourEnCours = true
      if (relaisDepuis !== null && e.text.includes(DEBUT_RELAIS)) tourRelais = e.turnId
      // la demande d'un mod commence par « The <mod> plugin sent a message: » : le titre est la ligne d'après
      const lignes = e.text.split('\n').map(l => l.trim()).filter(Boolean)
      const titre = /plugin sent a message:$/.test(lignes[0] ?? '') ? lignes[1] : lignes[0]
      if (titre && !titre.startsWith('<')) demandeTour = titre // un message technique (« <agent-message … ») garde le titre
      if ((await read($, reglagesA)).fil) {
        const maintenant = await $.clock.now()
        suivis.set('claude', debutTour(suivis.get('claude') ?? nouveauSuivi(maintenant), maintenant))
        for (const k of [...suivis.keys()]) if (k !== 'claude') suivis.delete(k)
        await majLignes($)
      }
    }
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const fil = (await read($, reglagesA)).fil
    const id = e.agentId ?? 'claude'
    if (fil) {
      if (id !== 'claude') await nomAgent($, id)
      const maintenant = await $.clock.now()
      const s = suivis.get(id) ?? nouveauSuivi(maintenant)
      suivis.set(id, etape(s, String(e.tool))) // le mot change tout de suite ; les tâches, une fois l'outil fini
      await majLignes($)
    }
    const ran = await next(e)
    if (fil) {
      const s = suivis.get(id)
      if (s) {
        const resultat = (ran as { result?: unknown }).result
        suivis.set(id, appliquerAppel(s, String(e.tool), e, resultat))
        await majLignes($)
      }
    }
    return ran
  }).catch(($, e, next) => next(e)) // un souci du suivi ne doit jamais bloquer un outil

  on('turn.complete', async ($, e, next) => {
    const id = e.agentId ?? 'claude'
    if (!e.agentId) {
      tourEnCours = false
      const cache = pourcentageCache(e.usage)
      if (cache !== null) await update($, cacheA, () => cache)
    }
    if (!e.agentId && e.durationMs > SEUIL_SON_MS && !e.isAborted && (await read($, reglagesA)).fil) {
      void carillon($).catch(() => { /* pas de sortie audio */ })
    }
    if (!e.agentId) {
      // fin de la réponse : tout passe au vert, puis s'efface au bout de 5 s (ou à « Fermer », ou à la prochaine demande)
      const maintenant = await $.clock.now()
      let change = false
      for (const [k, s] of suivis) if (s.fin === null) { suivis.set(k, finir(s, maintenant)); change = true }
      if (change) await majLignes($)
    } else {
      // un sous-agent fini pendant que Claude travaille encore : sa ligne passe au vert, puis s'efface au bout de 5 s
      const s = suivis.get(id)
      if (s && s.fin === null) {
        suivis.set(id, finir(s, await $.clock.now()))
        await majLignes($)
      }
    }
    if (!e.agentId && relaisDepuis !== null && e.turnId === tourRelais) {
      const debut = relaisDepuis
      relaisDepuis = null
      tourRelais = null
      let mtime: number | null = null
      // à la racine du projet, comme le demande la consigne : le dossier courant suit les « cd » de Claude
      try { mtime = (await $.fs.stat(`${await $.session.root()}/relais.md`)).mtimeMs } catch { mtime = null }
      if (relaisEcrit(mtime, debut)) {
        // vider la conversation une fois le tour vraiment fini, hors de ce hook
        $.clock.after(300, () => {
          void (async () => {
            try {
              await $.command.run({ command: 'clear' })
              const isFilled = await remplirSiVide($, REPRISE_RELAIS)
              $.ui.toast(isFilled ? 'Pupitre : relais passé. Appuie sur Entrée pour reprendre.' : 'Pupitre : relais passé. Pour reprendre, demande : « Lis relais.md et reprends ».')
            } catch {
              $.ui.toast('Pupitre : relais.md est écrit, mais la conversation n a pas pu être vidée. Tape /clear.')
            }
          })()
        })
        return next(e)
      }
      $.ui.toast("Le relais n'a pas été écrit : la conversation est conservée.")
      return next(e)
    }
    // relais automatique : un dépassement vu en plein tour se traite ici, une fois le travail fini
    if (!e.agentId && !e.isAborted && relaisDepuis === null) await surveillerRelais($)
    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    derniereUsage = { context: e.context, rateLimits: e.rateLimits }
    const maintenant = await $.clock.now()
    await update($, mesuresA, () => lireMesures(derniereUsage!, maintenant))
    await surveillerRelais($)
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const T = $.ui.resolve(e) as unknown as Elements
    if (e.surface === 'terminal' || T.Svg === undefined) enTexte = true
    const r = await read($, reglagesA)
    const lignes = await read($, lignesA)
    const autres = await read($, autresA)
    const mesures = await read($, mesuresA)
    const relais = await read($, relaisA)
    // sur le bureau, relais, plume et Réglages sont dans la barre du bas (voir SessionMode) : « Effacer » et le cache restent ici
    const tous = await boutonsDe($, r, piedDe(lignes, autres, mesures, relais.seuil))
    const boutons = e.surface === 'desktop' ? tous.filter(b => b.cle === 'effacer') : tous
    await read($, maintenantA) // abonne la bande au tic (voir le tic d'une seconde) ; les images, elles, veulent l'heure exacte du dessin
    const maintenant = await $.clock.now()
    const cache = await read($, cacheA)
    const animations = await read($, animationsA)
    const arbre = dessinerBande(T, e.surface, e.props.bodyColumns, e.props.maxRows, {
      reglages: r,
      mesures,
      animations,
      cache,
      expliquerCache: () => { if (cache !== null) $.ui.toast(explicationCache(cache)) },
      lignes,
      autres,
      maintenant,
      boutons,
      fermer: () => { void fermerFil($) },
      fermerAutre: id => { void update($, autresA, l => l.filter(a => a.id !== id)) },
      reglage: {
        ouvert: await read($, ouvertA),
        basculer: c => { void boutonReglage($, c) },
        replier: () => { void update($, ouvertA, () => false) },
        relais,
        seuil: sens => { void reglerRelais($, x => ({ ...x, seuil: changerSeuil(x.seuil, sens) })) },
        auto: () => { void reglerRelais($, x => ({ ...x, auto: !x.auto })) },
        animations,
        choisirAnimations: a => { void choisirAnimations($, a) },
      },
    })
    return arbre === null ? next(e) : (arbre as never)
  })

  // Sur le bureau, relais, plume et Réglages sont dans la barre du bas de la zone de texte (demande du 12/10/2026), là où
  // il met les modes (« focus ») : en petites pastilles, 24 caractères de large au plus (vu dans son code, puis sur capture :
  // les libellés entiers étaient coupés après le premier), d'où les mots courts. Le bureau reconstruit la bande en entier à
  // chaque redessin : à part, et sans lire les barres ni la jauge, ces boutons ne sont plus refaits par elles, et le clic
  // tient. Au terminal, cette place est celle des modes du moteur : les boutons restent dans la bande.
  on('ui.render', { component: 'SessionMode' }, async ($, e, next) => {
    if (e.surface !== 'desktop') return next(e)
    const r = await read($, reglagesA)
    if (!jaugeVisible(r)) return next(e)
    const T = $.ui.resolve(e) as unknown as Elements
    const ligne = dessinerBoutons(T, await boutonsDe($, r, { effacer: false, relais: null }, true), null)
    if (e.props.modes.length === 0) return ligne as never
    const { Box, Text } = T
    return (<Box flexDirection="row" gap={1}><Text dimColor wrap="truncate">{e.props.modes.join(' & ')}</Text>{ligne}</Box>) as never
  })

  on('command.run', { command: 'pupitre' }, async $ => bascule($, 'pupitre'))
  on('command.run', { command: 'jauge' }, async $ => bascule($, 'jauge'))
  on('command.run', { command: 'fil' }, async $ => bascule($, 'fil'))
  on('command.run', { command: 'relais' }, async $ => bascule($, 'relais'))
  on('command.run', { command: 'plume' }, async $ => bascule($, 'plume'))
  on('command.run', { command: 'cap' }, async $ => bascule($, 'cap'))
}

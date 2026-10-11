import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Autre, LigneFil, Mesures, Plume, ReglageRelais, Reglages } from '../types'
import { AUCUN, basculer, changerSeuil, jaugeVisible, lireRelais, lireReglages, type Commande } from './reglages'
import { MESURES_VIDES, lireMesures, pourcentageCache, type UsageLu } from './jauge'
import { dessinerBande, type Bouton, type Elements } from './bande'
import { appliquerAppel, debutTour, etape, finir, ligneDe, lignesGardees, nouveauSuivi, type Suivi } from './fil'
import { CONSIGNE_CAP_AUTO, CONSIGNE_FIL, REPRISE_RELAIS, consigneRelais, SYSTEME_PLUME, nettoyerReponse, promptPlume, relaisEcrit, type Capacite } from './textes'
import { PERIME_MS, ficheDe, lireFiche, nomFichier, suivreAutres, titreDe, type Fiche } from './partage'

type Dollar = EngineInterface // le `$` de chaque hook

export const reglagesA = atom({ plugin: 'pupitre', key: 'reglages' } as const, AUCUN)
export const mesuresA = atom({ plugin: 'pupitre', key: 'mesures' } as const, MESURES_VIDES as Mesures)

export const lignesA = atom({ plugin: 'pupitre', key: 'lignes' } as const, [] as LigneFil[])
export const autresA = atom({ plugin: 'pupitre', key: 'autres' } as const, [] as Autre[])
export const maintenantA = atom({ plugin: 'pupitre', key: 'maintenant' } as const, 0)
export const plumeA = atom({ plugin: 'pupitre', key: 'plume' } as const, { original: null, jusqua: 0, enCours: false } as Plume)
export const ouvertA = atom({ plugin: 'pupitre', key: 'reglagesOuverts' } as const, false)
export const chargeA = atom({ plugin: 'pupitre', key: 'charge' } as const, false)
export const relaisA = atom({ plugin: 'pupitre', key: 'relais' } as const, lireRelais(undefined) as ReglageRelais)
export const cacheA = atom({ plugin: 'pupitre', key: 'cache' } as const, null as number | null)

let derniereUsage: UsageLu | null = null

const suivis = new Map<string, Suivi>()        // 'claude' ou l'agentId
const noms = new Map<string, string>()         // agentId -> « Sous-agent n · description »
let numeroAgent = 0
// Un /clear ouvre une conversation neuve à l'état vide, sans session.start : le tic d'une seconde remet alors
// réglages et mesures, et les barres gardées à la fin de l'ancienne conversation.
let gardeClear: { lignes: LigneFil[]; autres: Autre[] } = { lignes: [], autres: [] }
let relaisDepuis: number | null = null // heure du clic sur « Passer le relais », tant que le relais est en cours
const SEUIL_SON_MS = 30_000 // carillon seulement après un travail de plus de 30 s
let tourEnCours = false // turn.start ne dit pas qui démarre : on ne remet à zéro qu'au début d'un tour principal
let demandeTour = '' // le début de la demande en cours : titre de la ligne de Claude
let seuilPasse = false // le contexte a dépassé le seuil du relais : on ne prévient qu'une fois par dépassement

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
  await update($, lignesA, () => lignes)
  await update($, maintenantA, () => maintenant)
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
      const { isFilled } = await $.prompt.fill({ text: texte, mode: 'replace' })
      $.ui.toast(isFilled ? 'Pupitre : appuie sur Entrée pour envoyer la demande.' : `Pupitre : la demande n'a pas pu partir (${refus}).`)
    })()
  })
}

async function lancerRelais($: Dollar): Promise<void> {
  if (relaisDepuis !== null) return
  relaisDepuis = await $.clock.now()
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
  seuilPasse = true
  if (auto && !tourEnCours) await lancerRelais($)
  else $.ui.toast(`Pupitre : contexte à ${Math.round(ctx)} %, pense à passer le relais.`)
}

async function reglerRelais($: Dollar, f: (r: ReglageRelais) => ReglageRelais): Promise<void> {
  const r = f(await read($, relaisA))
  await update($, relaisA, () => r)
  await $.store.set('relais', r)
  seuilPasse = false
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
  const etat = await read($, plumeA)
  if (etat.enCours) return
  const { text: brouillon } = await $.prompt.read()
  if (!brouillon.trim()) { $.ui.toast("Écris d'abord ta demande."); return }
  await update($, plumeA, p => ({ ...p, enCours: true }))
  try {
    const demande = { system: SYSTEME_PLUME, prompt: promptPlume(brouillon, await capacites($)), maxTokens: 2000, timeoutMs: 60_000 }
    let r = await $.model.complete({ ...demande, model: 'sonnet' })
    if (!r.isAnswered && r.reason === 'api-error') r = await $.model.complete({ ...demande, model: await $.session.model() })
    const texte = r.isAnswered ? nettoyerReponse(r.text) : ''
    if (!texte) { $.ui.toast('Amélioration impossible : réessaie.'); return }
    const fait = await $.prompt.fill({ text: texte, mode: 'replace' })
    if (!fait.isFilled) { $.ui.toast("La zone de texte n'est pas disponible."); return }
    const jusqua = (await $.clock.now()) + 30_000
    await update($, plumeA, p => ({ ...p, original: brouillon, jusqua }))
    $.clock.after(30_000, () => { void update($, plumeA, p => (p.jusqua === jusqua ? { ...p, original: null } : p)) })
  } finally {
    await update($, plumeA, p => ({ ...p, enCours: false }))
  }
}

// Le moteur ne joue un son que sur macOS (afplay) ; sous Windows, il ne joue rien : PowerShell lit alors le fichier du mod.
async function carillon($: Dollar): Promise<void> {
  if ((await $.env.get('OS')) !== 'Windows_NT') return $.audio.play({ asset: 'assets/carillon.wav' })
  const wav = `${$.plugin.root}/assets/carillon.wav`.replace(/'/g, "''")
  await $.process.run(['powershell.exe', '-NoProfile', '-NonInteractive', '-Command', `(New-Object Media.SoundPlayer '${wav}').PlaySync()`])
}

async function fermerFil($: Dollar): Promise<void> {
  if ([...suivis.values()].some(s => s.fin === null)) return // seulement une fois le travail fini
  suivis.clear()
  await majLignes($)
}

async function revenir($: Dollar): Promise<void> {
  const p = await read($, plumeA)
  if (p.original === null) return
  await $.prompt.fill({ text: p.original, mode: 'replace' })
  await update($, plumeA, x => ({ ...x, original: null }))
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

    $.clock.every(30_000, () => {
      void (async () => {
        if (!derniereUsage) return
        const maintenant = await $.clock.now()
        await update($, mesuresA, () => lireMesures(derniereUsage!, maintenant))
      })()
    })
    $.clock.every(1000, () => {
      void (async () => {
        if (!(await read($, chargeA))) { // après un /clear
          await charger($)
          await update($, lignesA, () => gardeClear.lignes)
          await update($, autresA, () => gardeClear.autres)
        }
        const lignes = await read($, lignesA)
        if (lignes.some(l => !l.fini)) await majLignes($)
      })()
    })

    // Partage avec les autres discussions du PC : chaque session écrit sa fiche et lit celles des autres.
    const maison = (await $.env.get('USERPROFILE')) ?? (await $.env.get('HOME')) ?? ''
    const dossier = `${maison}/.claude/pupitre/sessions`
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
        if (JSON.stringify(avant) !== JSON.stringify(suivre(avant))) await update($, autresA, suivre)
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
    if (next.origin.plugin === 'pupitre' || e.text.trimStart().startsWith('/') || !(await read($, reglagesA)).cap) return next(e)
    return next({ ...e, context: [...(e.context ?? []), CONSIGNE_CAP_AUTO] })
  })

  on('turn.start', async ($, e, next) => {
    if (!tourEnCours) {
      tourEnCours = true
      if (e.text.trim()) demandeTour = e.text.trim().split('\n')[0]!
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
      // fin de la réponse : tout passe au vert et reste affiché jusqu'à « Fermer » ou la prochaine demande
      const maintenant = await $.clock.now()
      let change = false
      for (const [k, s] of suivis) if (s.fin === null) { suivis.set(k, finir(s, maintenant)); change = true }
      if (change) await majLignes($)
    } else {
      // un sous-agent fini pendant que Claude travaille encore : sa ligne passe au vert et reste jusqu'à la croix
      const s = suivis.get(id)
      if (s && s.fin === null) {
        suivis.set(id, finir(s, await $.clock.now()))
        await majLignes($)
      }
    }
    if (!e.agentId && relaisDepuis !== null) {
      const debut = relaisDepuis
      relaisDepuis = null
      let mtime: number | null = null
      try { mtime = (await $.fs.stat(`${await $.session.cwd()}/relais.md`)).mtimeMs } catch { mtime = null }
      if (relaisEcrit(mtime, debut)) {
        // vider la conversation une fois le tour vraiment fini, hors de ce hook
        $.clock.after(300, () => {
          void (async () => {
            try {
              await $.command.run({ command: 'clear' })
              await $.prompt.fill({ text: REPRISE_RELAIS, mode: 'replace' })
              $.ui.toast('Pupitre : relais passé. Appuie sur Entrée pour reprendre.')
            } catch {
              $.ui.toast('Pupitre : relais.md est écrit, mais la conversation n a pas pu être vidée. Tape /clear.')
            }
          })()
        })
        return next(e)
      }
      $.ui.toast("Le relais n'a pas été écrit : la conversation est conservée.")
    }
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
    const r = await read($, reglagesA)
    const boutons: Bouton[] = []
    const mesures = await read($, mesuresA)
    const relais = await read($, relaisA)
    const ctx = mesures.contexte.pct
    if (r.relais) boutons.push({ cle: 'relais', libelle: ctx !== null && ctx >= relais.seuil ? `Passer le relais · ${Math.round(ctx)} %` : 'Passer le relais', action: () => { void lancerRelais($) } })
    const plume = await read($, plumeA)
    if (r.plume) {
      if (plume.original !== null) boutons.push({ cle: 'revenir', libelle: 'Revenir à mon texte', action: () => { void revenir($) } })
      else boutons.push({ cle: 'plume', libelle: plume.enCours ? 'Amélioration…' : 'Améliorer le prompt', action: () => { void ameliorer($) } })
    }
    boutons.push({ cle: 'reglages', libelle: 'Réglages', action: () => { void update($, ouvertA, o => !o) } })
    await read($, maintenantA) // abonne la bande au tic d'une seconde ; les images, elles, veulent l'heure exacte du dessin
    const maintenant = await $.clock.now()
    const arbre = dessinerBande(T, e.surface, e.props.bodyColumns, e.props.maxRows, {
      reglages: r,
      mesures,
      cache: await read($, cacheA),
      lignes: await read($, lignesA),
      autres: await read($, autresA),
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
      },
    })
    return arbre === null ? next(e) : (arbre as never)
  })

  on('command.run', { command: 'pupitre' }, async $ => bascule($, 'pupitre'))
  on('command.run', { command: 'jauge' }, async $ => bascule($, 'jauge'))
  on('command.run', { command: 'fil' }, async $ => bascule($, 'fil'))
  on('command.run', { command: 'relais' }, async $ => bascule($, 'relais'))
  on('command.run', { command: 'plume' }, async $ => bascule($, 'plume'))
  on('command.run', { command: 'cap' }, async $ => bascule($, 'cap'))
}

import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Autre, LigneFil, Mesures } from '../types'
import { AUCUN, basculer, lireReglages, type Commande } from './reglages'
import { MESURES_VIDES, lireMesures, type UsageLu } from './jauge'
import { dessinerBande, type Bouton, type Elements } from './bande'
import { appliquerAppel, debutTour, etape, finir, ligneDe, nouveauSuivi, type Suivi } from './fil'
import { CONSIGNE_FIL } from './textes'

type Dollar = EngineInterface // le `$` de chaque hook

export const reglagesA = atom({ plugin: 'pupitre', key: 'reglages' } as const, AUCUN)
export const mesuresA = atom({ plugin: 'pupitre', key: 'mesures' } as const, MESURES_VIDES as Mesures)

export const lignesA = atom({ plugin: 'pupitre', key: 'lignes' } as const, [] as LigneFil[])
export const autresA = atom({ plugin: 'pupitre', key: 'autres' } as const, [] as Autre[])
export const maintenantA = atom({ plugin: 'pupitre', key: 'maintenant' } as const, 0)

let derniereUsage: UsageLu | null = null

const suivis = new Map<string, Suivi>()        // 'claude' ou l'agentId
const noms = new Map<string, string>()         // agentId -> « Sous-agent n · description »
let numeroAgent = 0
let tourEnCours = false // turn.start ne dit pas qui démarre : on ne remet à zéro qu'au début d'un tour principal

async function majLignes($: Dollar): Promise<void> {
  const maintenant = await $.clock.now()
  const avant = await read($, lignesA)
  const ordre = ['claude', ...[...suivis.keys()].filter(k => k !== 'claude')]
  const lignes: LigneFil[] = []
  for (const id of ordre) {
    const s = suivis.get(id)
    if (!s) continue
    const qui = id === 'claude' ? 'Claude' : (noms.get(id) ?? 'Sous-agent')
    lignes.push(ligneDe(id, qui, s, maintenant, avant.find(l => l.id === id)))
  }
  await update($, lignesA, () => lignes)
  await update($, maintenantA, () => maintenant)
}

async function nomAgent($: Dollar, agentId: string): Promise<void> {
  if (noms.has(agentId)) return
  numeroAgent += 1
  let description = ''
  try { description = (await $.agent.list()).find(a => a.id === agentId)?.description ?? '' } catch { /* liste indisponible */ }
  noms.set(agentId, `Sous-agent ${numeroAgent}${description ? ` · ${description}` : ''}`)
}

const DESCRIPTIONS: Record<Commande, string> = {
  pupitre: 'Allume tout le pupitre (ou l éteint si tout est déjà allumé)',
  jauge: 'Allume ou éteint la jauge (contexte, limites 5 h et 7 jours)',
  fil: 'Allume ou éteint les barres de progression de Claude et des sous-agents',
  relais: 'Allume ou éteint le bouton « Passer le relais »',
  plume: 'Allume ou éteint le bouton « Améliorer le prompt »',
}

async function bascule($: Dollar, c: Commande) {
  const { reglages, message } = basculer(await read($, reglagesA), c)
  await update($, reglagesA, () => reglages)
  await $.store.set('reglages', reglages)
  $.ui.toast(message)
  return { text: message }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    // noms écrits en toutes lettres : le moteur reconnaît ainsi que ces hooks répondent à leurs propres commandes
    await $.command.register({ name: 'pupitre', description: DESCRIPTIONS.pupitre })
    await $.command.register({ name: 'jauge', description: DESCRIPTIONS.jauge })
    await $.command.register({ name: 'fil', description: DESCRIPTIONS.fil })
    await $.command.register({ name: 'relais', description: DESCRIPTIONS.relais })
    await $.command.register({ name: 'plume', description: DESCRIPTIONS.plume })
    const garde = lireReglages(await $.store.get('reglages'))
    await update($, reglagesA, () => garde)

    const u = await $.session.usage()
    derniereUsage = { context: u.context, rateLimits: u.rateLimits }
    const maintenant0 = await $.clock.now()
    await update($, mesuresA, () => lireMesures(derniereUsage!, maintenant0))
    $.clock.every(30_000, () => {
      void (async () => {
        if (!derniereUsage) return
        const maintenant = await $.clock.now()
        await update($, mesuresA, () => lireMesures(derniereUsage!, maintenant))
      })()
    })
    $.clock.every(1000, () => {
      void (async () => {
        const lignes = await read($, lignesA)
        if (lignes.some(l => !l.fini)) await majLignes($)
      })()
    })
    return next(e)
  })

  on('prompt.compose', async ($, e, next) => {
    const r = await next(e)
    if (!(await read($, reglagesA)).fil) return r
    return { ...r, sections: [...r.sections, { id: 'pupitre-fil', text: CONSIGNE_FIL, scope: 'session' as const }] }
  })

  on('turn.start', async ($, e, next) => {
    if (!tourEnCours && (await read($, reglagesA)).fil) {
      tourEnCours = true
      const maintenant = await $.clock.now()
      suivis.set('claude', debutTour(suivis.get('claude') ?? nouveauSuivi(maintenant), maintenant))
      for (const k of [...suivis.keys()]) if (k !== 'claude') suivis.delete(k)
      await majLignes($)
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
    if (!e.agentId) tourEnCours = false
    const s = suivis.get(id)
    if (s && s.fin === null) {
      const maintenant = await $.clock.now()
      suivis.set(id, finir(s, maintenant))
      await majLignes($)
      $.clock.after(4000, () => {
        void (async () => {
          const t = suivis.get(id)
          if (t && t.fin !== null) { suivis.delete(id); await majLignes($) }
        })()
      })
    }
    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    derniereUsage = { context: e.context, rateLimits: e.rateLimits }
    const maintenant = await $.clock.now()
    await update($, mesuresA, () => lireMesures(derniereUsage!, maintenant))
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const T = $.ui.resolve(e) as unknown as Elements
    const r = await read($, reglagesA)
    const boutons: Bouton[] = []
    const arbre = dessinerBande(T, e.surface, e.props.bodyColumns, e.props.maxRows, {
      reglages: r,
      mesures: await read($, mesuresA),
      lignes: await read($, lignesA),
      autres: await read($, autresA),
      maintenant: await read($, maintenantA),
      boutons,
      majJauge: 0,
    })
    return arbre === null ? next(e) : (arbre as never)
  })

  on('command.run', { command: 'pupitre' }, async $ => bascule($, 'pupitre'))
  on('command.run', { command: 'jauge' }, async $ => bascule($, 'jauge'))
  on('command.run', { command: 'fil' }, async $ => bascule($, 'fil'))
  on('command.run', { command: 'relais' }, async $ => bascule($, 'relais'))
  on('command.run', { command: 'plume' }, async $ => bascule($, 'plume'))
}

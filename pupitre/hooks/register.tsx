import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Mesures } from '../types'
import { AUCUN, basculer, jaugeVisible, lireReglages, type Commande } from './reglages'
import { MESURES_VIDES, lireMesures, type UsageLu } from './jauge'
import { dessinerJauge, type Bouton, type Elements } from './bande'

type Dollar = EngineInterface // le `$` de chaque hook

export const reglagesA = atom({ plugin: 'pupitre', key: 'reglages' } as const, AUCUN)
export const mesuresA = atom({ plugin: 'pupitre', key: 'mesures' } as const, MESURES_VIDES as Mesures)

let derniereUsage: UsageLu | null = null

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
    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    derniereUsage = { context: e.context, rateLimits: e.rateLimits }
    const maintenant = await $.clock.now()
    await update($, mesuresA, () => lireMesures(derniereUsage!, maintenant))
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const r = await read($, reglagesA)
    if (e.props.hasSurvey || !jaugeVisible(r)) return next(e)
    const T = $.ui.resolve(e) as unknown as Elements
    const boutons: Bouton[] = []
    return dessinerJauge(T, e.surface, e.props.bodyColumns, await read($, mesuresA), r.jauge, boutons, 0) as never
  })

  on('command.run', { command: 'pupitre' }, async $ => bascule($, 'pupitre'))
  on('command.run', { command: 'jauge' }, async $ => bascule($, 'jauge'))
  on('command.run', { command: 'fil' }, async $ => bascule($, 'fil'))
  on('command.run', { command: 'relais' }, async $ => bascule($, 'relais'))
  on('command.run', { command: 'plume' }, async $ => bascule($, 'plume'))
}

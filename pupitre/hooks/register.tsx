import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Autre, LigneFil, Mesures } from '../types'
import { AUCUN, basculer, lireReglages, type Commande } from './reglages'
import { MESURES_VIDES, lireMesures, type UsageLu } from './jauge'
import { dessinerBande, type Bouton, type Elements } from './bande'
import { appliquerAppel, debutTour, etape, finir, ligneDe, nouveauSuivi, type Suivi } from './fil'
import { CONSIGNE_CAP, CONSIGNE_FIL, DEMANDE_CAP } from './textes'
import { PERIME_MS, autresActives, ficheDe, lireFiche, nomFichier, titreDe, type Fiche } from './partage'

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
let consigneSuivante: string[] | null = null // consigne invisible jointe à la prochaine demande envoyée par le mod
const SEUIL_SON_MS = 30_000 // carillon seulement après un travail de plus de 30 s
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
    await $.command.register({ name: 'cap', description: 'Claude te pose ses questions pour fixer la suite' })
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
        const autres = autresActives(fiches, moi, maintenant)
        const avant = await read($, autresA)
        if (JSON.stringify(avant) !== JSON.stringify(autres)) await update($, autresA, () => autres)
      })()
    })
    return next(e)
  })

  on('session.end', async ($, e, next) => {
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
    if (!e.agentId && e.durationMs > SEUIL_SON_MS && !e.isAborted && (await read($, reglagesA)).fil) {
      void $.audio.play({ asset: 'assets/carillon.wav' }).catch(() => { /* pas de sortie audio */ })
    }
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

  on('prompt.submit', async ($, e, next) => {
    if (consigneSuivante) {
      const c = consigneSuivante
      consigneSuivante = null
      return next({ ...e, context: [...(e.context ?? []), ...c] })
    }
    return next(e)
  }).catch(($, e, next) => next(e)) // ne jamais bloquer une demande

  on('command.run', { command: 'cap' }, async $ => {
    consigneSuivante = [CONSIGNE_CAP]
    void $.prompt.submit({ text: DEMANDE_CAP })
    return { text: 'Pupitre : je prépare mes questions sur la suite.' }
  })

  on('command.run', { command: 'pupitre' }, async $ => bascule($, 'pupitre'))
  on('command.run', { command: 'jauge' }, async $ => bascule($, 'jauge'))
  on('command.run', { command: 'fil' }, async $ => bascule($, 'fil'))
  on('command.run', { command: 'relais' }, async $ => bascule($, 'relais'))
  on('command.run', { command: 'plume' }, async $ => bascule($, 'plume'))
}

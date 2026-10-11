import type { Autre, LigneFil, Mesure, Mesures, Reglages } from '../types'
import { PALETTES_FIL, PALETTES_JAUGE, TEXTE_NIVEAU, barreTexte, couleurJauge, graineDe, svgFil, svgSimple } from './pixels'
import { formatPct } from './jauge'
import { chrono } from './textes'
import { jaugeVisible, toutAllume, type Commande } from './reglages'

export const PX_COL = 8 // pixels par colonne de la bande sur l'application (à confirmer, tâche 11)

// Table des éléments rendue par $.ui.resolve(e) ; typée lâchement car elle diffère d'une surface à l'autre.
export type Elements = Record<string, (props: Record<string, unknown>) => unknown>
export type Bouton = { cle: string; libelle: string; action: () => void }

export type Morceau = { nom: string; pct: string; court: string }
const ECART = 3, BARRE_MAX = 20, BARRE_CONFORT = 6, BARRE_MIN = 4

// Jauge sur une seule ligne : « nom ▰▰▱ 86 % ↻ 2 h 12 » × 3, puis les boutons. Les barres prennent la place
// qui reste (20 colonnes au plus) ; si elles tombent sous 6, les comptes à rebours passent dans l'info-bulle.
// parCar : colonnes par caractère (1 au terminal, 0,75 sur le bureau dont la police est plus serrée).
export function dispositionJauge(colonnes: number, morceaux: readonly Morceau[], placeBoutons: number, parCar: number): { barre: number; avecCourt: boolean } {
  const n = morceaux.length
  if (n === 0) return { barre: 0, avecCourt: false }
  const texte = (avecCourt: boolean) => morceaux.reduce((t, m) => {
    const court = avecCourt && m.court ? m.court.length : 0
    return t + (m.nom.length + m.pct.length + court) * parCar + 2 + (court > 0 ? 1 : 0)
  }, 0)
  const fixe = ECART * (n - 1) + (placeBoutons > 0 ? ECART + placeBoutons : 0)
  const barre = (avecCourt: boolean) => Math.floor((colonnes - fixe - texte(avecCourt)) / n)
  const large = barre(true)
  if (large >= BARRE_CONFORT) return { barre: Math.min(BARRE_MAX, large), avecCourt: true }
  return { barre: Math.max(BARRE_MIN, Math.min(BARRE_MAX, barre(false))), avecCourt: false }
}

function mesure(T: Elements, surface: string, nom: string, m: Mesure, barre: number, avecCourt: boolean, majLe: number) {
  const { Box, Text, Svg } = T
  const pct = m.pct ?? 0
  const titre = `${nom} : ${m.detail}`
  const w = Math.max(20, Math.round(barre * PX_COL))
  const court = avecCourt ? (m.court ?? '') : ''
  const dessin = surface === 'terminal' || Svg === undefined
    ? <Text dimColor>{barreTexte(pct / 100, barre)}</Text>
    : <Svg source={svgSimple({ largeur: w, hauteur: 10, cellule: 2, rayon: 4, progression: pct / 100, palette: PALETTES_JAUGE[couleurJauge(pct)], graine: graineDe(nom), majLe, titre })} alt={`${titre}, ${formatPct(m.pct)}`} width={w} height={10} />
  return (
    <Box key={nom} flexDirection="row" alignItems="center" gap={1}>
      <Text dimColor>{nom}</Text>
      {dessin}
      <Text bold>{formatPct(m.pct)}</Text>
      {court ? <Text dimColor>{court}</Text> : null}
    </Box>
  )
}

// La ligne de la jauge : les trois mesures seules, réparties sur toute la largeur.
export function dessinerJauge(T: Elements, surface: string, colonnes: number, mesures: Mesures, majLe: number) {
  const { Box } = T
  const parCar = surface === 'terminal' ? 1 : 0.75
  const liste: [string, Mesure][] = [['Contexte', mesures.contexte], ['Limite 5 h', mesures.cinqH], ['Limite 7 jours', mesures.septJ]]
  const { barre, avecCourt } = dispositionJauge(colonnes, liste.map(([nom, m]) => ({ nom, pct: formatPct(m.pct), court: m.court ?? '' })), 0, parCar)
  return (
    <Box flexDirection="row" alignItems="center" justifyContent="space-between" gap={ECART}>
      {liste.map(([nom, m]) => mesure(T, surface, nom, m, barre, avecCourt, majLe))}
    </Box>
  )
}

// La ligne des boutons, au-dessus de la jauge, calée à droite.
export function dessinerBoutons(T: Elements, boutons: readonly Bouton[]) {
  const { Box, Button } = T
  return (
    <Box flexDirection="row" alignItems="center" justifyContent="flex-end" gap={1}>
      {boutons.map(b => <Button key={b.cle} label={b.libelle} onPress={() => b.action()} />)}
    </Box>
  )
}

export type EtatBande = {
  reglages: Reglages; mesures: Mesures; lignes: readonly LigneFil[]; autres: readonly Autre[]
  maintenant: number; boutons: readonly Bouton[]; majJauge: number
  fermer?: () => void // « Fermer » : retire les barres /fil une fois le travail fini
  reglage?: ActionsReglage // ligne « Pupitre : ✓ Jauge ✓ Fil … », dépliée par le bouton « Réglages »
}

export type ActionsReglage = { ouvert: boolean; basculer: (c: Commande) => void; replier: () => void }
const FONCTIONS: readonly [Exclude<Commande, 'pupitre'>, string][] = [['jauge', 'Jauge'], ['fil', 'Fil'], ['relais', 'Relais'], ['plume', 'Plume']]

export function dessinerReglages(T: Elements, r: Reglages, a: ActionsReglage) {
  const { Box, Text, Button } = T
  return (
    <Box flexDirection="row" alignItems="center" gap={1}>
      <Text dimColor>Pupitre :</Text>
      {FONCTIONS.map(([c, nom]) => <Button key={`basculer-${c}`} label={`${r[c] ? '✓' : '○'} ${nom}`} onPress={() => a.basculer(c)} />)}
      <Button key="tout" label={toutAllume(r) ? 'Tout éteindre' : 'Tout allumer'} onPress={() => a.basculer('pupitre')} />
      <Button key="replier" label="Replier" onPress={() => a.replier()} />
    </Box>
  )
}

const COL_QUI = 14, COL_COMPTEUR = 8, COL_CHRONO = 8, COL_FERMER = 10

function ligne(T: Elements, surface: string, colonnes: number, l: LigneFil, maintenant: number, fermer?: () => void) {
  const { Box, Text, Svg, Button } = T
  const largeur = Math.max(10, colonnes - COL_QUI - COL_COMPTEUR - COL_CHRONO - 4 - (fermer ? COL_FERMER : 0))
  const fin = l.finiLe ?? maintenant
  const w = Math.max(40, Math.round(largeur * PX_COL))
  const barre = surface === 'terminal' || Svg === undefined
    ? <Text color={TEXTE_NIVEAU[l.niveau]}>{barreTexte(l.progression, largeur - l.mot.length - 1)} {l.mot}</Text>
    : <Svg key={`b-${l.id}`} source={svgFil({ largeur: w, progression: l.progression, avant: l.avant, niveau: l.niveau, niveauAvant: l.niveauAvant, fini: l.fini, eclat: l.eclat, mot: l.mot, graine: graineDe(l.id), majLe: l.majLe })} alt={`${l.qui} : ${l.tache}, ${l.compteur}`} width={w} height={22} />
  return (
    <Box key={`l-${l.id}`} flexDirection="row" gap={1} alignItems="flex-end">
      <Box width={COL_QUI}><Text dimColor wrap="truncate">{l.qui}</Text></Box>
      <Box flexDirection="column" flexGrow={1}>
        <Text color={TEXTE_NIVEAU[l.niveau]} bold wrap="truncate">{l.tache}</Text>
        {barre}
      </Box>
      <Box width={COL_COMPTEUR} justifyContent="flex-end"><Text dimColor>{l.compteur}</Text></Box>
      <Box width={COL_CHRONO} justifyContent="flex-end"><Text dimColor>{chrono(fin - l.debut)}</Text></Box>
      {fermer ? <Button key="fermer-fil" label="Fermer" onPress={() => fermer()} /> : null}
    </Box>
  )
}

export function dessinerBande(T: Elements, surface: string, colonnes: number, maxRows: number, s: EtatBande) {
  const { Box } = T
  const jauge = jaugeVisible(s.reglages)
  const lignes = s.reglages.fil ? (maxRows < 8 ? s.lignes.filter(l => l.id === 'claude') : s.lignes) : []
  const autres = s.reglages.fil ? s.autres : []
  if (!jauge && lignes.length === 0 && autres.length === 0) return null
  // « Fermer » sur la première ligne /fil, une fois que tout est fini
  const fermer = s.fermer && lignes.length > 0 && lignes.every(l => l.fini) ? s.fermer : undefined
  // de haut en bas : autres discussions, /fil, réglages dépliés, boutons, puis la jauge, toujours au plus près de la zone de texte
  const rangs = [
    autres.length > 0 ? dessinerAutres(T, surface, colonnes, autres, s.maintenant) : null,
    ...lignes.map((l, i) => ligne(T, surface, colonnes, l, s.maintenant, i === 0 ? fermer : undefined)),
    jauge && s.reglage?.ouvert ? dessinerReglages(T, s.reglages, s.reglage) : null,
    jauge && s.boutons.length > 0 ? dessinerBoutons(T, s.boutons) : null,
    s.reglages.jauge && maxRows >= 3 ? dessinerJauge(T, surface, colonnes, s.mesures, s.majJauge) : null,
  ].filter(r => r !== null)
  if (rangs.length === 1) return rangs[0]
  return <Box flexDirection="column" gap={1}>{rangs}</Box>
}

export function dessinerAutres(T: Elements, surface: string, colonnes: number, autres: readonly Autre[], maintenant: number) {
  const { Box, Text, Svg } = T
  const largeur = Math.max(10, colonnes - COL_QUI - COL_COMPTEUR - COL_CHRONO - 4)
  const w = Math.max(20, Math.round(largeur * PX_COL))
  return (
    <Box flexDirection="column">
      <Text dimColor>Autres discussions en cours</Text>
      {autres.map(a => (
        <Box key={`a-${a.id}`} flexDirection="row" gap={1} alignItems="flex-end">
          <Box width={COL_QUI}><Text wrap="truncate">{a.titre}</Text></Box>
          <Box flexDirection="column" flexGrow={1}>
            <Text dimColor wrap="truncate">{a.tache}</Text>
            {surface === 'terminal' || Svg === undefined
              ? <Text dimColor>{barreTexte(a.progression, largeur)}</Text>
              : <Svg source={svgSimple({ largeur: w, hauteur: 10, cellule: 2, rayon: 4, progression: a.progression, palette: PALETTES_FIL[a.niveau]!, graine: graineDe(a.id), majLe: a.majLe })} alt={`${a.titre} : ${a.tache}`} width={w} height={10} />}
          </Box>
          <Box width={COL_COMPTEUR} justifyContent="flex-end"><Text dimColor>{a.compteur}</Text></Box>
          <Box width={COL_CHRONO} justifyContent="flex-end"><Text dimColor>{chrono(maintenant - a.debut)}</Text></Box>
        </Box>
      ))}
    </Box>
  )
}

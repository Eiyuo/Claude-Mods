import type { Autre, LigneFil, Mesure, Mesures, Reglages } from '../types'
import { PALETTES_JAUGE, TEXTE_NIVEAU, barreTexte, couleurJauge, graineDe, svgFil, svgSimple } from './pixels'
import { formatPct } from './jauge'
import { chrono } from './textes'
import { jaugeVisible } from './reglages'

export const PX_COL = 8 // pixels par colonne de la bande sur l'application (à confirmer, tâche 11)

// Table des éléments rendue par $.ui.resolve(e) ; typée lâchement car elle diffère d'une surface à l'autre.
export type Elements = Record<string, (props: Record<string, unknown>) => unknown>
export type Bouton = { cle: string; libelle: string; action: () => void }

function mesure(T: Elements, surface: string, nom: string, m: Mesure, largeurCol: number, majLe: number) {
  const { Box, Text, Svg } = T
  const pct = m.pct ?? 0
  const barre = surface === 'terminal' || Svg === undefined
    ? <Text dimColor>{barreTexte(pct / 100, Math.max(6, largeurCol - 2))}</Text>
    : <Svg source={svgSimple({ largeur: largeurCol * PX_COL, hauteur: 10, cellule: 2, rayon: 4, progression: pct / 100, palette: PALETTES_JAUGE[couleurJauge(pct)], graine: graineDe(nom), majLe })} alt={`${nom} : ${formatPct(m.pct)}`} isInteractive />
  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box flexDirection="row" justifyContent="space-between">
        <Text dimColor>{nom}</Text>
        <Text bold>{formatPct(m.pct)}</Text>
      </Box>
      {barre}
      <Text dimColor wrap="truncate">{m.detail}</Text>
    </Box>
  )
}

export function dessinerJauge(T: Elements, surface: string, colonnes: number, mesures: Mesures, montrerMesures: boolean, boutons: readonly Bouton[], majLe: number) {
  const { Box, Button } = T
  const placeBoutons = boutons.reduce((n, b) => n + b.libelle.length + 6, 0)
  const largeurCol = Math.max(10, Math.floor((colonnes - placeBoutons) / 3) - 2)
  return (
    <Box flexDirection="row" gap={2} alignItems="flex-end">
      {montrerMesures && mesure(T, surface, 'Contexte', mesures.contexte, largeurCol, majLe)}
      {montrerMesures && mesure(T, surface, 'Limite 5 h', mesures.cinqH, largeurCol, majLe)}
      {montrerMesures && mesure(T, surface, 'Limite 7 jours', mesures.septJ, largeurCol, majLe)}
      {boutons.map(b => <Button key={b.cle} label={b.libelle} onPress={() => b.action()} />)}
    </Box>
  )
}

export type EtatBande = {
  reglages: Reglages; mesures: Mesures; lignes: readonly LigneFil[]; autres: readonly Autre[]
  maintenant: number; boutons: readonly Bouton[]; majJauge: number
}

const COL_QUI = 14, COL_COMPTEUR = 8, COL_CHRONO = 8

function ligne(T: Elements, surface: string, colonnes: number, l: LigneFil, maintenant: number) {
  const { Box, Text, Svg } = T
  const largeur = Math.max(10, colonnes - COL_QUI - COL_COMPTEUR - COL_CHRONO - 4)
  const fin = l.finiLe ?? maintenant
  const barre = surface === 'terminal' || Svg === undefined
    ? <Text color={TEXTE_NIVEAU[l.niveau]}>{barreTexte(l.progression, largeur - l.mot.length - 1)} {l.mot}</Text>
    : <Svg key={`b-${l.id}`} source={svgFil({ largeur: largeur * PX_COL, progression: l.progression, avant: l.avant, niveau: l.niveau, niveauAvant: l.niveauAvant, fini: l.fini, eclat: l.eclat, mot: l.mot, graine: graineDe(l.id), majLe: l.majLe })} alt={`${l.qui} : ${l.tache}, ${l.compteur}`} isInteractive />
  return (
    <Box key={`l-${l.id}`} flexDirection="row" gap={1} alignItems="flex-end">
      <Box width={COL_QUI}><Text dimColor wrap="truncate">{l.qui}</Text></Box>
      <Box flexDirection="column" flexGrow={1}>
        <Text color={TEXTE_NIVEAU[l.niveau]} bold wrap="truncate">{l.tache}</Text>
        {barre}
      </Box>
      <Box width={COL_COMPTEUR} justifyContent="flex-end"><Text dimColor>{l.compteur}</Text></Box>
      <Box width={COL_CHRONO} justifyContent="flex-end"><Text dimColor>{chrono(fin - l.debut)}</Text></Box>
    </Box>
  )
}

export function dessinerBande(T: Elements, surface: string, colonnes: number, maxRows: number, s: EtatBande) {
  const { Box } = T
  const jauge = jaugeVisible(s.reglages)
  const lignes = s.reglages.fil ? (maxRows < 8 ? s.lignes.filter(l => l.id === 'claude') : s.lignes) : []
  const autres = s.reglages.fil ? s.autres : []
  if (!jauge && lignes.length === 0 && autres.length === 0) return null
  return (
    <Box flexDirection="column" gap={1}>
      {jauge && dessinerJauge(T, surface, colonnes, s.mesures, s.reglages.jauge && maxRows >= 6, s.boutons, s.majJauge)}
      {lignes.map(l => ligne(T, surface, colonnes, l, s.maintenant))}
      {autres.length > 0 && dessinerAutres(T, surface, colonnes, autres, s.maintenant)}
    </Box>
  )
}

// Rempli à la tâche 6. Jusque-là, elle ne dessine rien.
export function dessinerAutres(_T: Elements, _surface: string, _colonnes: number, _autres: readonly Autre[], _maintenant: number) {
  return null
}

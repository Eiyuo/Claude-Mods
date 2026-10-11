import type { Mesure, Mesures } from '../types'
import { PALETTES_JAUGE, barreTexte, couleurJauge, graineDe, svgSimple } from './pixels'
import { formatPct } from './jauge'

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

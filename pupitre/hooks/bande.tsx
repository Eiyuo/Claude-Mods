import type { Autre, LigneFil, Mesure, Mesures, Niveau, ReglageRelais, Reglages } from '../types'
import { HAUTEUR_FIL, PALETTES_JAUGE, TEXTE_NIVEAU, barreTexte, couleurJauge, graineDe, svgFil, svgSimple } from './pixels'
import { formatPct } from './jauge'
import { chrono } from './textes'
import { jaugeVisible, toutAllume, type Commande } from './reglages'

export const PX_COL = 8 // pixels par colonne de la bande sur l'application (à confirmer, tâche 11)

// Table des éléments rendue par $.ui.resolve(e) ; typée lâchement car elle diffère d'une surface à l'autre.
export type Elements = Record<string, (props: Record<string, unknown>) => unknown>
export type Bouton = { cle: string; libelle: string; action: () => void }

export type Morceau = { nom: string; abrege?: string; pct: string; court: string }
const ECART = 3, BARRE_MAX = 20, BARRE_CONFORT = 6, BARRE_MIN = 4

// Colonnes occupées par un caractère sur le bureau : la colonne y fait 8 px (PX_COL) et un caractère environ
// 7,2 px (mesuré sur une capture, le gras compris) ; 0,95 garde une petite marge.
export const PAR_CAR_BUREAU = 0.95

// Jauge sur une seule ligne : « nom ▰▰▱ 86 % ↻ 2 h 12 » × 3. Les barres prennent la place qui reste (20 colonnes
// au plus). Quand la place manque, dans l'ordre : les comptes à rebours « ↻ » quittent la ligne (barres sous 6),
// puis les noms raccourcissent (« 5 h », « 7 jours »), puis les barres descendent à 4. Les textes ne passent jamais
// à la ligne : au pire, ils se coupent avec « … ».
// parCar : colonnes par caractère (1 au terminal, PAR_CAR_BUREAU sur le bureau).
export function dispositionJauge(colonnes: number, morceaux: readonly Morceau[], placeBoutons: number, parCar: number): { barre: number; avecCourt: boolean; abrege: boolean } {
  const n = morceaux.length
  if (n === 0) return { barre: 0, avecCourt: false, abrege: false }
  const texte = (avecCourt: boolean, abrege: boolean) => morceaux.reduce((t, m) => {
    const court = avecCourt && m.court ? m.court.length : 0
    const nom = abrege ? (m.abrege ?? m.nom) : m.nom
    return t + Math.ceil((nom.length + m.pct.length + court) * parCar) + 2 + (court > 0 ? 1 : 0)
  }, 0)
  const fixe = ECART * (n - 1) + (placeBoutons > 0 ? ECART + placeBoutons : 0)
  const barre = (avecCourt: boolean, abrege: boolean) => Math.floor((colonnes - fixe - texte(avecCourt, abrege)) / n)
  for (const avecCourt of [true, false]) {
    const b = barre(avecCourt, false)
    if (b >= BARRE_CONFORT) return { barre: Math.min(BARRE_MAX, b), avecCourt, abrege: false }
  }
  return { barre: Math.max(BARRE_MIN, Math.min(BARRE_MAX, barre(false, true))), avecCourt: false, abrege: true }
}

function mesure(T: Elements, surface: string, nom: string, affiche: string, m: Mesure, barre: number, avecCourt: boolean, maintenant: number) {
  const { Box, Text, Svg } = T
  const pct = m.pct ?? 0
  const titre = `${nom} : ${m.detail}`
  const w = Math.max(20, Math.round(barre * PX_COL))
  const court = avecCourt ? (m.court ?? '') : ''
  const dessin = surface === 'terminal' || Svg === undefined
    ? <Text dimColor wrap="truncate">{barreTexte(pct / 100, barre)}</Text>
    : <Svg source={svgSimple({ largeur: w, hauteur: 10, cellule: 2, rayon: 4, progression: pct / 100, palette: PALETTES_JAUGE[couleurJauge(pct)], alerte: couleurJauge(pct) === 'rouge', graine: graineDe(nom), maintenant, titre })} alt={`${titre}, ${formatPct(m.pct)}`} width={w} height={10} />
  return (
    <Box key={nom} flexDirection="row" alignItems="center" gap={1}>
      <Text dimColor wrap="truncate">{affiche}</Text>
      {dessin}
      <Text bold wrap="truncate">{formatPct(m.pct)}</Text>
      {court ? <Text dimColor wrap="truncate">{court}</Text> : null}
    </Box>
  )
}

// La ligne de la jauge : les trois mesures seules, réparties sur toute la largeur.
export function dessinerJauge(T: Elements, surface: string, colonnes: number, mesures: Mesures, maintenant: number) {
  const { Box } = T
  const parCar = surface === 'terminal' ? 1 : PAR_CAR_BUREAU
  const liste: [string, string, Mesure][] = [['Contexte', 'Contexte', mesures.contexte], ['Limite 5 h', '5 h', mesures.cinqH], ['Limite 7 jours', '7 jours', mesures.septJ]]
  const { barre, avecCourt, abrege } = dispositionJauge(colonnes, liste.map(([nom, court, m]) => ({ nom, abrege: court, pct: formatPct(m.pct), court: m.court ?? '' })), 0, parCar)
  return (
    <Box flexDirection="row" alignItems="center" justifyContent="space-between" gap={ECART}>
      {liste.map(([nom, court, m]) => mesure(T, surface, nom, abrege ? court : nom, m, barre, avecCourt, maintenant))}
    </Box>
  )
}

// La ligne des boutons, sous la jauge, calée à droite ; à gauche, la part du cache quand on la connaît.
export function dessinerBoutons(T: Elements, boutons: readonly Bouton[], cache: number | null) {
  const { Box, Button, Text } = T
  return (
    <Box flexDirection="row" alignItems="center" justifyContent={cache === null ? 'flex-end' : 'space-between'} gap={1}>
      {cache === null ? null : <Text dimColor wrap="truncate">{`Cache ${cache} %`}</Text>}
      <Box flexDirection="row" alignItems="center" gap={1}>
        {boutons.map(b => <Button key={b.cle} label={b.libelle} onPress={() => b.action()} />)}
      </Box>
    </Box>
  )
}

export type EtatBande = {
  reglages: Reglages; mesures: Mesures; lignes: readonly LigneFil[]; autres: readonly Autre[]
  maintenant: number // heure du dessin : chronos, et animations des images (voir pixels.ts)
  boutons: readonly Bouton[]
  cache: number | null // part de la dernière demande lue dans le cache, en %
  fermer?: () => void // croix « Fermer » : retire les barres /fil une fois le travail fini
  fermerAutre?: (id: string) => void // croix d'une autre discussion finie : retire sa ligne
  reglage?: ActionsReglage // ligne « Pupitre : ✓ Jauge ✓ Fil … », dépliée par le bouton « Réglages »
}

export type ActionsReglage = {
  ouvert: boolean; basculer: (c: Commande) => void; replier: () => void
  relais: ReglageRelais; seuil: (sens: -1 | 1) => void; auto: () => void
}
const FONCTIONS: readonly [Exclude<Commande, 'pupitre'>, string][] = [['jauge', 'Jauge'], ['fil', 'Fil'], ['relais', 'Relais'], ['plume', 'Plume'], ['cap', 'Cap']]

export function dessinerReglages(T: Elements, r: Reglages, a: ActionsReglage) {
  const { Box, Text, Button } = T
  const fonctions = (
    <Box flexDirection="row" alignItems="center" gap={1}>
      <Text dimColor wrap="truncate">Pupitre :</Text>
      {FONCTIONS.map(([c, nom]) => <Button key={`basculer-${c}`} label={`${r[c] ? '✓' : '○'} ${nom}`} onPress={() => a.basculer(c)} />)}
      <Button key="tout" label={toutAllume(r) ? 'Tout éteindre' : 'Tout allumer'} onPress={() => a.basculer('pupitre')} />
      <Button key="replier" label="Replier" onPress={() => a.replier()} />
    </Box>
  )
  if (!r.relais) return fonctions
  return (
    <Box flexDirection="column" gap={1}>
      {fonctions}
      <Box flexDirection="row" alignItems="center" gap={1}>
        <Text dimColor wrap="truncate">Relais à :</Text>
        <Button key="seuil-moins" label="−" onPress={() => a.seuil(-1)} />
        <Text wrap="truncate">{`${a.relais.seuil} %`}</Text>
        <Button key="seuil-plus" label="+" onPress={() => a.seuil(1)} />
        <Button key="relais-auto" label={`${a.relais.auto ? '✓' : '○'} Automatique`} onPress={() => a.auto()} />
      </Box>
    </Box>
  )
}

// Une ligne par travail, aux mêmes colonnes partout : icône, titre, barre, %, temps, croix. La place de la croix
// est gardée sur chaque ligne : toutes les barres ont la même longueur, et les textes restent alignés.
// Au plus juste : « 100 % », « 12:34 », et la croix (« [ × ] » au terminal) ; le reste va à la barre.
const COL_ICONE = 2, COL_TITRE = 26, COL_PCT = 5, COL_CHRONO = 6, COL_FERMER = 5

export function largeurBarre(colonnes: number): number {
  return Math.max(10, colonnes - COL_ICONE - COL_TITRE - COL_PCT - COL_CHRONO - COL_FERMER - 5)
}

type Rang = {
  cle: string; icone: string; titre: string; secondaire: boolean
  progression: number; avant: number; niveau: Niveau; niveauAvant: Niveau; fini: boolean; eclat: boolean
  mot: string; majLe: number; debut: number; finiLe: number | null
  fermer?: { cle: string; action: () => void }
}

function rang(T: Elements, surface: string, colonnes: number, r: Rang, maintenant: number) {
  const { Box, Text, Svg, Button } = T
  const largeur = largeurBarre(colonnes)
  const w = Math.max(40, Math.round(largeur * PX_COL))
  const pct = `${Math.round((r.fini ? 1 : r.progression) * 100)} %`
  const barre = surface === 'terminal' || Svg === undefined
    ? <Text color={TEXTE_NIVEAU[r.niveau]} wrap="truncate">{barreTexte(r.fini ? 1 : r.progression, Math.max(1, largeur - r.mot.length - 1))} {r.mot}</Text>
    : <Svg key={`b-${r.cle}`} source={svgFil({ largeur: w, progression: r.progression, avant: r.avant, niveau: r.niveau, niveauAvant: r.niveauAvant, fini: r.fini, eclat: r.eclat, mot: r.mot, graine: graineDe(r.cle), majLe: r.majLe, maintenant })} alt={`${r.titre} : ${r.mot}, ${pct}`} width={w} height={HAUTEUR_FIL} />
  return (
    <Box key={`l-${r.cle}`} flexDirection="row" gap={1} alignItems="center">
      <Box width={COL_ICONE}><Text color={TEXTE_NIVEAU[r.niveau]} wrap="truncate">{r.icone}</Text></Box>
      <Box width={COL_TITRE}><Text dimColor={r.secondaire} wrap="truncate">{r.titre}</Text></Box>
      <Box width={largeur}>{barre}</Box>
      <Box width={COL_PCT} justifyContent="flex-end"><Text dimColor wrap="truncate">{pct}</Text></Box>
      <Box width={COL_CHRONO} justifyContent="flex-end"><Text dimColor wrap="truncate">{chrono((r.finiLe ?? maintenant) - r.debut)}</Text></Box>
      {/* croix de fermeture : le bureau ne dessine d'un Button que son label (ni son contenu, ni role « dismiss »
          dans cette bande, vérifié sur capture), donc la croix est le label ; le cadre du bouton garde la zone cliquable. */}
      <Box width={COL_FERMER} justifyContent="flex-end">{r.fermer ? <Button key={r.fermer.cle} label="×" onPress={() => r.fermer!.action()} /> : null}</Box>
    </Box>
  )
}

function depuisLigne(l: LigneFil, fermer?: () => void): Rang {
  return {
    cle: l.id, icone: l.id !== 'claude' ? '↳' : l.fini ? '✓' : '●', titre: l.qui, secondaire: l.id !== 'claude',
    progression: l.progression, avant: l.avant, niveau: l.niveau, niveauAvant: l.niveauAvant, fini: l.fini, eclat: l.eclat,
    mot: l.mot, majLe: l.majLe, debut: l.debut, finiLe: l.finiLe,
    fermer: fermer ? { cle: 'fermer-fil', action: fermer } : undefined,
  }
}

function tronquer(t: string, n: number): string {
  return t.length <= n ? t : `${t.slice(0, Math.max(1, n - 1))}…`
}

// « demande · dossier », le dossier raccourci à 8 caractères pour laisser la place à la demande.
export function titreAutre(demande: string, dossier: string): string {
  const d = tronquer(dossier, 8)
  return `${tronquer(demande, Math.max(8, COL_TITRE - d.length - 3))} · ${d}`
}

function depuisAutre(a: Autre, fermer?: (id: string) => void): Rang {
  const fini = a.finiLe !== null
  return {
    cle: a.id, icone: fini ? '✓' : '●', secondaire: false,
    titre: titreAutre(a.demande || a.tache || 'Discussion', a.titre),
    progression: a.progression, avant: a.progression, niveau: a.niveau, niveauAvant: a.niveau, fini, eclat: false,
    mot: a.mot || (fini ? '✓ Fini' : 'En cours'), majLe: a.majLe, debut: a.debut, finiLe: a.finiLe,
    fermer: fini && fermer ? { cle: `fermer-${a.id}`, action: () => fermer(a.id) } : undefined,
  }
}

export function dessinerBande(T: Elements, surface: string, colonnes: number, maxRows: number, s: EtatBande) {
  const { Box } = T
  const jauge = jaugeVisible(s.reglages)
  const lignes = s.reglages.fil ? (maxRows < 8 ? s.lignes.filter(l => l.id === 'claude') : s.lignes) : []
  const autres = s.reglages.fil ? s.autres : []
  if (!jauge && lignes.length === 0 && autres.length === 0) return null
  // croix « Fermer » sur la première ligne /fil, une fois que tout est fini
  const fermer = s.fermer && lignes.length > 0 && lignes.every(l => l.fini) ? s.fermer : undefined
  // de haut en bas : cette discussion (Claude, puis ses sous-agents), les autres, la jauge, les boutons, les réglages
  const rangs = [
    ...lignes.map((l, i) => rang(T, surface, colonnes, depuisLigne(l, i === 0 ? fermer : undefined), s.maintenant)),
    ...autres.map(a => rang(T, surface, colonnes, depuisAutre(a, s.fermerAutre), s.maintenant)),
    s.reglages.jauge && maxRows >= 3 ? dessinerJauge(T, surface, colonnes, s.mesures, s.maintenant) : null,
    jauge && s.boutons.length > 0 ? dessinerBoutons(T, s.boutons, s.reglages.jauge ? s.cache : null) : null,
    jauge && s.reglage?.ouvert ? dessinerReglages(T, s.reglages, s.reglage) : null,
  ].filter(r => r !== null)
  if (rangs.length === 1) return rangs[0]
  return <Box flexDirection="column" gap={1}>{rangs}</Box>
}

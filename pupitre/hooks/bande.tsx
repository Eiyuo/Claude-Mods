import type { Animations, Autre, LigneFil, Mesure, Mesures, Niveau, ReglageRelais, Reglages } from '../types'
import { HAUTEUR_FIL, PALETTES_JAUGE, TEXTE_APPEL, TEXTE_NIVEAU, barreTexte, couleurJauge, graineDe, svgFil, svgSimple } from './pixels'
import { formatPct } from './jauge'
import { chrono } from './textes'
import { jaugeVisible, toutAllume, type Commande } from './reglages'

export const PX_COL = 8 // pixels par colonne de la bande sur l'application (à confirmer, tâche 11)

// Table des éléments rendue par $.ui.resolve(e) ; typée lâchement car elle diffère d'une surface à l'autre.
export type Elements = Record<string, (props: Record<string, unknown>) => unknown>
export type Bouton = { cle: string; libelle: string; action: () => void }

export type Morceau = { nom: string; abrege?: string; pct: string; court: string }
const BARRE_MAX = 20, BARRE_CONFORT = 6, BARRE_MIN = 4
export type Largeur = (texte: string, gras?: boolean) => number // en colonnes

// Largeur d'un texte sur le bureau, en colonnes de 8 px (PX_COL), lettre par lettre : calée sur les textes de la jauge
// mesurés sur une capture du 12/10/2026 (« Limite 7 jours » y prend 10 colonnes, et non 13 à 0,95 par lettre), sans
// jamais passer dessous : de 1 à 11 % au-dessus de chaque mesure.
export const largeurBureau: Largeur = (texte, gras = false) => Array.from(texte).reduce((l, c) =>
  l + (c === ' ' ? 0.4 : /[iljtfr.,:;'·│]/.test(c) ? 0.5 : /[mwMW%]/.test(c) ? 1.3 : /[A-ZÀ-Ý]/.test(c) ? 1.15 : 1), 0) * (gras ? 1.1 : 1)

// Jauge sur une seule ligne, serrée : « nom ▰▰▱ 86 % ↻ 2 h 12 │ … │ Cache 82 % » (demande du 13/10/2026). Les barres
// prennent la place qui reste (20 colonnes au plus). Quand la place manque, dans l'ordre : le cache redescend sur la
// ligne du dessous, les comptes à rebours « ↻ » quittent la ligne (barres sous 6), les noms raccourcissent (« 5 h »,
// « 7 jours »), puis les barres descendent à 4. Les textes ne passent jamais à la ligne : au pire, ils se coupent avec « … ».
// cache : sa largeur (0 sans cache).
export function dispositionJauge(colonnes: number, morceaux: readonly Morceau[], cache: number, largeur: Largeur): { barre: number; avecCourt: boolean; abrege: boolean; avecCache: boolean } {
  const n = morceaux.length
  if (n === 0) return { barre: 0, avecCourt: false, abrege: false, avecCache: false }
  const trait = 2 + largeur('│') // un écart de chaque côté du trait
  const texte = (avecCourt: boolean, abrege: boolean) => morceaux.reduce((t, m) =>
    t + largeur(abrege ? (m.abrege ?? m.nom) : m.nom) + largeur(m.pct, true) + 2 + (avecCourt && m.court ? largeur(m.court) + 1 : 0), 0)
  const barre = (avecCourt: boolean, abrege: boolean, avecCache: boolean) =>
    Math.floor((colonnes - trait * (n - 1) - (avecCache ? trait + cache : 0) - texte(avecCourt, abrege)) / n)
  if (cache > 0) {
    const b = barre(true, false, true)
    if (b >= BARRE_CONFORT) return { barre: Math.min(BARRE_MAX, b), avecCourt: true, abrege: false, avecCache: true }
  }
  for (const avecCourt of [true, false]) {
    const b = barre(avecCourt, false, false)
    if (b >= BARRE_CONFORT) return { barre: Math.min(BARRE_MAX, b), avecCourt, abrege: false, avecCache: false }
  }
  return { barre: Math.max(BARRE_MIN, Math.min(BARRE_MAX, barre(false, true, false))), avecCourt: false, abrege: true, avecCache: false }
}

function mesure(T: Elements, surface: string, nom: string, affiche: string, m: Mesure, barre: number, avecCourt: boolean, maintenant: number, animations: Animations) {
  const { Box, Text, Svg } = T
  const pct = m.pct ?? 0
  const titre = `${nom} : ${m.detail}`
  const w = Math.max(20, Math.round(barre * PX_COL))
  const court = avecCourt ? (m.court ?? '') : ''
  const dessin = surface === 'terminal' || Svg === undefined
    ? <Text dimColor wrap="truncate">{barreTexte(pct / 100, barre)}</Text>
    : <Svg source={svgSimple({ largeur: w, hauteur: 10, cellule: 2, rayon: 4, progression: pct / 100, palette: PALETTES_JAUGE[couleurJauge(pct)], alerte: couleurJauge(pct) === 'rouge', graine: graineDe(nom), maintenant, titre, animations })} alt={`${titre}, ${formatPct(m.pct)}`} width={w} height={10} />
  return (
    <Box key={nom} flexDirection="row" alignItems="center" gap={1}>
      <Text dimColor wrap="truncate">{affiche}</Text>
      {dessin}
      <Text bold wrap="truncate">{formatPct(m.pct)}</Text>
      {court ? <Text dimColor wrap="truncate">{court}</Text> : null}
    </Box>
  )
}

// La ligne de la jauge : les trois mesures serrées, séparées d'un trait, et le cache au bout quand il tient ; un clic
// sur le cache l'explique. avecCache dit si le cache a trouvé sa place, sinon il reste sur la ligne du dessous.
export function dessinerJauge(T: Elements, surface: string, colonnes: number, mesures: Mesures, maintenant: number, animations: Animations, cache: number | null, expliquer?: () => void) {
  const { Box, Text, Button } = T
  const largeur: Largeur = surface === 'terminal' ? t => t.length : largeurBureau
  const libelleCache = `Cache ${cache} %`
  const liste: [string, string, Mesure][] = [['Contexte', 'Contexte', mesures.contexte], ['Limite 5 h', '5 h', mesures.cinqH], ['Limite 7 jours', '7 jours', mesures.septJ]]
  const { barre, avecCourt, abrege, avecCache } = dispositionJauge(colonnes, liste.map(([nom, court, m]) => ({ nom, abrege: court, pct: formatPct(m.pct), court: m.court ?? '' })), cache === null ? 0 : largeur(libelleCache), largeur)
  const trait = (cle: string) => <Text key={cle} dimColor wrap="truncate">│</Text>
  return {
    avecCache,
    arbre: (
      <Box flexDirection="row" alignItems="center" gap={1}>
        {liste.flatMap(([nom, court, m], i) => [i > 0 ? trait(`trait-${nom}`) : null, mesure(T, surface, nom, abrege ? court : nom, m, barre, avecCourt, maintenant, animations)])}
        {avecCache ? trait('trait-cache') : null}
        {avecCache ? (expliquer ? <Button key="cache" label={libelleCache} plain dimColor onPress={() => expliquer()} /> : <Text dimColor wrap="truncate">{libelleCache}</Text>) : null}
      </Box>
    ),
  }
}

// La ligne des boutons, sous la jauge, calée à droite ; à gauche, la part du cache quand on la connaît, qu'un clic explique.
export function dessinerBoutons(T: Elements, boutons: readonly Bouton[], cache: number | null, expliquer?: () => void) {
  const { Box, Button, Text } = T
  return (
    <Box flexDirection="row" alignItems="center" justifyContent={cache === null ? 'flex-end' : 'space-between'} gap={1}>
      {cache === null ? null : expliquer
        ? <Button key="cache" label={`Cache ${cache} % ⓘ`} plain dimColor onPress={() => expliquer()} />
        : <Text dimColor wrap="truncate">{`Cache ${cache} %`}</Text>}
      <Box flexDirection="row" alignItems="center" gap={1}>
        {boutons.map(b => <Button key={b.cle} label={b.libelle} onPress={() => b.action()} />)}
      </Box>
    </Box>
  )
}

// Ce que la ligne des boutons sait des barres et de la jauge : assez de barres finies pour « Effacer » (une seule : sa
// croix suffit), et le contexte une fois le seuil du relais passé.
export type Pied = { effacer: boolean; relais: number | null }
export function piedDe(lignes: readonly LigneFil[], autres: readonly Autre[], mesures: Mesures, seuil: number): Pied {
  const ctx = mesures.contexte.pct
  return {
    effacer: lignes.filter(l => l.fini).length + autres.filter(a => a.finiLe !== null).length >= 2,
    relais: ctx !== null && ctx >= seuil ? Math.round(ctx) : null,
  }
}

export type EtatBande = {
  reglages: Reglages; mesures: Mesures; lignes: readonly LigneFil[]; autres: readonly Autre[]
  maintenant: number // heure du dessin : chronos, et animations des images (voir pixels.ts)
  animations: Animations // réglage « Animations » : complètes, réduites ou coupées
  boutons: readonly Bouton[]
  cache: number | null // part de la dernière demande lue dans le cache, en %
  expliquerCache?: () => void // clic sur le cache : une notification l'explique
  fermer?: () => void // croix « Fermer » : retire les barres /fil une fois le travail fini
  fermerAutre?: (id: string) => void // croix d'une autre discussion finie : retire sa ligne
  ouvrirAutre?: (id: string) => void // clic sur le titre d'une autre discussion : l'application bascule dessus
  reglage?: ActionsReglage // ligne « Pupitre : ✓ Jauge ✓ Fil … », dépliée par le bouton « Réglages »
}

export type ActionsReglage = {
  ouvert: boolean; basculer: (c: Commande) => void; replier: () => void
  relais: ReglageRelais; seuil: (sens: -1 | 1) => void; auto: () => void
  animations: Animations; choisirAnimations: (a: Animations) => void
}
const FONCTIONS: readonly [Exclude<Commande, 'pupitre'>, string][] = [['jauge', 'Jauge'], ['fil', 'Fil'], ['relais', 'Relais'], ['plume', 'Plume'], ['cap', 'Cap']]
const ANIMATIONS: readonly [Animations, string][] = [['completes', 'Complètes'], ['reduites', 'Réduites'], ['coupees', 'Coupées']]

export function dessinerReglages(T: Elements, surface: string, r: Reglages, a: ActionsReglage) {
  const { Box, Text, Button, Svg } = T
  const images = surface !== 'terminal' && Svg !== undefined // ailleurs, les barres sont en caractères, sans animation
  return (
    <Box flexDirection="column" gap={1}>
      <Box flexDirection="row" alignItems="center" gap={1}>
        <Text dimColor wrap="truncate">Pupitre :</Text>
        {FONCTIONS.map(([c, nom]) => <Button key={`basculer-${c}`} label={`${r[c] ? '✓' : '○'} ${nom}`} onPress={() => a.basculer(c)} />)}
        <Button key="tout" label={toutAllume(r) ? 'Tout éteindre' : 'Tout allumer'} onPress={() => a.basculer('pupitre')} />
        <Button key="replier" label="Replier" onPress={() => a.replier()} />
      </Box>
      {r.relais ? (
        <Box flexDirection="row" alignItems="center" gap={1}>
          <Text dimColor wrap="truncate">Relais à :</Text>
          <Button key="seuil-moins" label="−" onPress={() => a.seuil(-1)} />
          <Text wrap="truncate">{`${a.relais.seuil} %`}</Text>
          <Button key="seuil-plus" label="+" onPress={() => a.seuil(1)} />
          <Button key="relais-auto" label={`${a.relais.auto ? '✓' : '○'} Automatique`} onPress={() => a.auto()} />
        </Box>
      ) : null}
      {images ? (
        <Box flexDirection="row" alignItems="center" gap={1}>
          <Text dimColor wrap="truncate">Animations :</Text>
          {ANIMATIONS.map(([v, nom]) => <Button key={`animations-${v}`} label={`${a.animations === v ? '✓' : '○'} ${nom}`} onPress={() => a.choisirAnimations(v)} />)}
        </Box>
      ) : null}
    </Box>
  )
}

// Une ligne par travail, aux mêmes colonnes partout : icône, titre, barre, %, croix. La place de la croix
// est gardée sur chaque ligne : toutes les barres ont la même longueur, et les textes restent alignés.
// Au plus juste : « 100 % » et la croix (« [ × ] » au terminal) ; le reste va à la barre. Le temps n'a plus de colonne :
// il est dans l'étiquette de la barre (demande du 12/10/2026).
const COL_ICONE = 2, COL_TITRE = 26, COL_PCT = 5, COL_FERMER = 5

export function largeurBarre(colonnes: number): number {
  return Math.max(10, colonnes - COL_ICONE - COL_TITRE - COL_PCT - COL_FERMER - 4)
}

type Rang = {
  cle: string; icone: string; titre: string; secondaire: boolean
  progression: number; avant: number; niveau: Niveau; niveauAvant: Niveau; fini: boolean; eclat: boolean
  mot: string; majLe: number; debut: number; finiLe: number | null
  attente: boolean // Claude attend ta réponse : « ? » et barre orange qui pulse
  fermer?: { cle: string; action: () => void }
  ouvrir?: { cle: string; action: () => void } // le titre se clique
}
const MOT_APPEL = 'Ta réponse ?'

function rang(T: Elements, surface: string, colonnes: number, r: Rang, maintenant: number, animations: Animations) {
  const { Box, Text, Svg, Button } = T
  const largeur = largeurBarre(colonnes)
  const w = Math.max(40, Math.round(largeur * PX_COL))
  const pct = `${Math.round((r.fini ? 1 : r.progression) * 100)} %`
  // le temps est dans l'étiquette : il tourne tout seul dans l'image pendant le travail, s'arrête une fois fini
  const avecTemps = `${r.mot} · ${chrono((r.finiLe ?? maintenant) - r.debut)}`
  const images = surface !== 'terminal' && Svg !== undefined
  const couleur = r.attente ? TEXTE_APPEL : TEXTE_NIVEAU[r.niveau]
  const mot = r.fini ? avecTemps : r.mot
  const barre = !images
    ? <Text color={couleur} wrap="truncate">{barreTexte(r.fini ? 1 : r.progression, Math.max(1, largeur - avecTemps.length - 1))} {avecTemps}</Text>
    : <Svg key={`b-${r.cle}`} source={svgFil({ largeur: w, progression: r.progression, avant: r.avant, niveau: r.niveau, niveauAvant: r.niveauAvant, fini: r.fini, eclat: r.eclat, mot, graine: graineDe(r.cle), majLe: r.majLe, maintenant, animations, attente: r.attente, depuis: r.fini ? undefined : r.debut })} alt={`${r.titre} : ${mot}, ${pct}`} width={w} height={HAUTEUR_FIL} />
  return (
    <Box key={`l-${r.cle}`} flexDirection="row" gap={1} alignItems="center">
      <Box width={COL_ICONE}><Text color={couleur} wrap="truncate">{r.icone}</Text></Box>
      <Box width={COL_TITRE}>{r.ouvrir
        ? <Button key={r.ouvrir.cle} label={r.titre} plain onPress={() => r.ouvrir!.action()} />
        : <Text dimColor={r.secondaire} wrap="truncate">{r.titre}</Text>}</Box>
      <Box width={largeur}>{barre}</Box>
      <Box width={COL_PCT} justifyContent="flex-end"><Text dimColor wrap="truncate">{pct}</Text></Box>
      {/* croix de fermeture : le bureau ne dessine d'un Button que son label (ni son contenu, ni role « dismiss »
          dans cette bande, vérifié sur capture), donc la croix est le label ; le cadre du bouton garde la zone cliquable. */}
      <Box width={COL_FERMER} justifyContent="flex-end">{r.fermer ? <Button key={r.fermer.cle} label="×" onPress={() => r.fermer!.action()} /> : null}</Box>
    </Box>
  )
}

function depuisLigne(l: LigneFil, fermer?: () => void): Rang {
  return {
    cle: l.id, icone: l.attente ? '?' : l.id !== 'claude' ? '↳' : l.fini ? '✓' : '●', titre: l.qui, secondaire: l.id !== 'claude',
    progression: l.progression, avant: l.avant, niveau: l.niveau, niveauAvant: l.niveauAvant, fini: l.fini, eclat: l.eclat,
    mot: l.attente ? MOT_APPEL : l.mot, majLe: l.majLe, debut: l.debut, finiLe: l.finiLe, attente: l.attente === true,
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

function depuisAutre(a: Autre, fermer?: (id: string) => void, ouvrir?: (id: string) => void): Rang {
  const fini = a.finiLe !== null
  return {
    // ⧉ : une autre fenêtre, en cours comme finie (la barre verte dit la fin) ; « ? » quand son Claude attend
    cle: a.id, icone: a.attente ? '?' : '⧉', secondaire: false, attente: a.attente === true,
    titre: titreAutre(a.demande || a.tache || 'Discussion', a.titre),
    // finie, toujours le vert de la fin, même si sa fiche vient d'une version à 4 couleurs (où la fin valait 3)
    progression: a.progression, avant: a.progression, niveau: fini ? 6 : a.niveau, niveauAvant: fini ? 6 : a.niveau, fini, eclat: false,
    mot: a.attente ? MOT_APPEL : a.mot || (fini ? '✓ Fini' : 'En cours'), majLe: a.majLe, debut: a.debut, finiLe: a.finiLe,
    fermer: fini && fermer ? { cle: `fermer-${a.id}`, action: () => fermer(a.id) } : undefined,
    ouvrir: ouvrir ? { cle: `ouvrir-${a.id}`, action: () => ouvrir(a.id) } : undefined,
  }
}

export function dessinerBande(T: Elements, surface: string, colonnes: number, maxRows: number, s: EtatBande) {
  const { Box, Text } = T
  const jauge = jaugeVisible(s.reglages)
  const lignes = s.reglages.fil ? (maxRows < 8 ? s.lignes.filter(l => l.id === 'claude') : s.lignes) : []
  const autres = s.reglages.fil ? s.autres : []
  if (!jauge && lignes.length === 0 && autres.length === 0) return null
  // croix « Fermer » sur la première ligne /fil, une fois que tout est fini
  const fermer = s.fermer && lignes.length > 0 && lignes.every(l => l.fini) ? s.fermer : undefined
  const ligneJauge = s.reglages.jauge && maxRows >= 3 ? dessinerJauge(T, surface, colonnes, s.mesures, s.maintenant, s.animations, s.cache, s.expliquerCache) : null
  const cacheDessous = s.reglages.jauge && !ligneJauge?.avecCache ? s.cache : null // pas de place sur la ligne de la jauge
  // de haut en bas : cette discussion (Claude, puis ses sous-agents), les autres, la jauge, les boutons, les réglages
  const rangs = [
    ...lignes.map((l, i) => rang(T, surface, colonnes, depuisLigne(l, i === 0 ? fermer : undefined), s.maintenant, s.animations)),
    // un titre discret sépare les autres conversations de la tienne (la bande ne trace pas de trait seul, rien qu'un cadre)
    autres.length > 0 ? <Text key="titre-autres" dimColor wrap="truncate">Autres discussions</Text> : null,
    ...autres.map(a => rang(T, surface, colonnes, depuisAutre(a, s.fermerAutre, s.ouvrirAutre), s.maintenant, s.animations)),
    ligneJauge?.arbre ?? null,
    // sur le bureau, les boutons sont dans la barre du bas : la ligne reste pour « Effacer », et le cache s'il n'a pas tenu
    jauge && (s.boutons.length > 0 || cacheDessous !== null) ? dessinerBoutons(T, s.boutons, cacheDessous, s.expliquerCache) : null,
    jauge && s.reglage?.ouvert ? dessinerReglages(T, surface, s.reglages, s.reglage) : null,
  ].filter(r => r !== null)
  if (rangs.length === 0) return null // sur le bureau, les boutons sont au pied de la zone de texte : rien d'autre à montrer
  if (rangs.length === 1) return rangs[0]
  return <Box flexDirection="column" gap={1}>{rangs}</Box>
}

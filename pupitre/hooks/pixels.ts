import type { Animations, Niveau } from '../types'
export type { Niveau } from '../types'

export const PALETTES_FIL: readonly (readonly string[])[] = [
  ['#B2A6EE', '#9687E4', '#7C6CDC', '#6452D0'],
  ['#84A8EC', '#6490E6', '#4678DC', '#2C60C8'],
  ['#5CC4BC', '#38B2AA', '#1E9C96', '#10827C'],
  ['#7CC280', '#58B060', '#3C9C48', '#288037'],
]
export const PALETTES_JAUGE = {
  vert: ['#7CC280', '#58B060', '#3C9C48', '#288037'],
  jaune: ['#F2D06B', '#EBC24A', '#DDB02E', '#C99A1C'],
  orange:['#F5AA5F', '#EE9646', '#E8862A', '#D6761E'],
  rouge: ['#E66E6E', '#DE5A5A', '#D64545', '#C43737'],
} as const
export const TEXTE_NIVEAU: readonly string[] = ['#5B4BC4', '#2C5FC0', '#0F7C76', '#2F7A3B']

const B4 = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]] as const
const PAS = 60 // vague de couleur : 60 tranches de gauche à droite, 15 ms d'écart (0,9 s sur toute la barre)
const EPS = 1e-6

export function niveauDe(progression: number, fini: boolean): Niveau {
  if (fini) return 3
  if (progression < 1 / 3 - EPS) return 0
  if (progression < 2 / 3 - EPS) return 1
  return 2
}

export function couleurJauge(pct: number): keyof typeof PALETTES_JAUGE {
  return pct >= 90 ? 'rouge' : pct >= 75 ? 'orange' : pct >= 50 ? 'jaune' : 'vert'
}

export function echapper(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function graineDe(s: string): number {
  let h = 7
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 100003
  return h / 100003 * 1000
}

export function bruit(i: number, g: number): number {
  const x = Math.sin(i * 12.9898 + g * 78.233) * 43758.5453
  return x - Math.floor(x)
}

function rgb(hex: string): number[] {
  return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16))
}
function versHex(c: readonly number[]): string {
  return '#' + c.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('').toUpperCase()
}
function clair(hex: string, k: number): string {
  return versHex(rgb(hex).map(v => v + (255 - v) * k))
}

// Les cases sont regroupées par (couleur, classe) en un seul <path> : le SVG reste court.
class Groupes {
  private m = new Map<string, string[]>()
  case(fill: string, cls: string, x: number, y: number, w: number, h: number): void {
    const cle = `${fill}|${cls}`
    const l = this.m.get(cle) ?? []
    l.push(`M${x} ${y}h${w}v${h}h${-w}z`)
    this.m.set(cle, l)
  }
  svg(extra = ''): string {
    let s = ''
    for (const [cle, segs] of this.m) {
      const [fill, cls] = cle.split('|')
      s += `<path${cls ? ` class="${cls}"` : ''} fill="${fill}"${extra} d="${segs.join('')}"/>`
    }
    return s
  }
}

// Dégradé tramé sur les 4 nuances entières, du clair au foncé vers le bord avant ; rendu plat, sans relief.
function teinte(palette: readonly string[], t: number, fini: boolean, i: number, j: number): string {
  const g = (fini ? 0.55 : t) * 3
  const lo = Math.floor(g)
  return palette[Math.min(3, (g - lo) * 16 > B4[i % 4]![j % 4]! ? lo + 1 : lo)]!
}

// Une image qui change est rechargée et ses animations repartiraient de zéro : on les cale sur l'horloge pour
// qu'elles reprennent où elles en étaient. --t (heure du dessin) pour les boucles, --u (temps écoulé depuis le
// changement) pour les effets qui ne jouent qu'une fois.
const CSS_COMMUN = (maintenant: number, majLe: number) => `svg{--t:${(-maintenant / 1000).toFixed(2)}s;--u:${((majLe - maintenant) / 1000).toFixed(2)}s}
.e{opacity:0;animation:etincelle 1.6s ease-in-out infinite}
@keyframes etincelle{0%,35%,65%,100%{opacity:0}50%{opacity:.85}}
@media (prefers-reduced-motion: reduce){.r,.e,.g,.k,.pop,.a0,.a1,.a2,.a3,.a4,.a5,.h0,.h1,.h2,.h3,.h4,.h5,.v,.c,.z,${RANGS(PAS).map(i => `.w${i}`).join(',')}{animation:none}.e,.r,.g,.b0,.b1,.b2,.b3,.b4,.b5{display:none}}`

// Éclat : une bande de lumière douce (40 % au centre), sur toute la hauteur, balaie la partie remplie colonne par
// colonne (une toutes les 18 ms), puis marque une pause avant de repartir (cycle de 2,6 s au moins).
function reflet(fin: number, h: number, c: number): string {
  if (fin < c * 4) return ''
  const n = 15
  const bw = n * c
  let cols = ''
  for (let k = 0; k < n; k++) cols += `<rect x="${k * c}" width="${c}" height="${h}" fill-opacity="${(0.4 * (1 - Math.abs(k - (n - 1) / 2) / ((n + 1) / 2))).toFixed(2)}"/>`
  const pas = Math.ceil((fin + bw) / c)
  const traversee = pas * 18
  const cycle = Math.max(2600, traversee + 800)
  return `<style>@keyframes reflet{0%{transform:translateX(${-bw}px)}${(traversee / cycle * 100).toFixed(1)}%,100%{transform:translateX(${pas * c - bw}px)}}` +
    `.r{animation:reflet ${cycle}ms steps(${pas}) infinite;animation-delay:var(--t)}</style><g class="r" fill="#FFFFFF">${cols}</g>`
}

export type OptionsFil = {
  largeur: number; progression: number; avant: number; niveau: Niveau; niveauAvant: Niveau
  fini: boolean; eclat: boolean; mot: string; graine: number; majLe: number; maintenant: number
  animations?: Animations // absent : complètes
}

// Réduites ou coupées, les boucles (étincelles, bande de lumière, tête de lecture, respiration, battement) ne sont pas
// dessinées du tout : l'image est plus légère et le bureau n'a plus rien à animer en continu.
const enBoucle = (a: Animations | undefined) => a === undefined || a === 'completes'

const retard = (ms: number) => `animation-delay:calc(var(--u) + ${ms}ms)`
const RANGS = (n: number) => Array.from({ length: n }, (_, i) => i)
export const HAUTEUR_FIL = 18 // une ligne de texte : la barre tient sur la ligne de son titre
const ATTENTE_MS = 20_000 // rien de changé depuis ce temps (outil, étape, %) : la barre s'assoupit
const assoupie = (o: OptionsFil) => !o.fini && o.maintenant - o.majLe >= ATTENTE_MS

// Le chrono redessine la bande chaque seconde : une image qui n'a pas changé rend le même texte, sans être recalculée,
// et le bureau n'a rien à recharger. L'heure n'entre pas dans la clé : --t et --u restent ceux de son premier dessin.
// Vérifié sur le bureau le 12/10/2026 : à texte identique, l'image n'est pas rechargée et ses animations continuent.
const dessins = new Map<string, string>()
function memoise(cle: string, dessiner: () => string): string {
  let s = dessins.get(cle)
  if (s === undefined) {
    if (dessins.size >= 32) dessins.clear() // les images affichées sont redessinées une fois, à la bonne heure
    s = dessiner()
    dessins.set(cle, s)
  }
  return s
}

function dessinerFil(o: OptionsFil, c: number): string {
  const W = Math.max(40, Math.round(o.largeur))
  const H = HAUTEUR_FIL
  const rows = 6
  const pal = PALETTES_FIL[o.niveau]!
  const palAvant = PALETTES_FIL[o.niveauAvant]!
  const fin = o.fini ? W : Math.round(Math.max(0, Math.min(1, o.progression)) * W)
  const finAvant = Math.round(Math.max(0, Math.min(1, o.avant)) * W)
  const endormie = assoupie(o)
  const boucles = enBoucle(o.animations)
  const fond = new Groupes()
  const sur = new Groupes()
  const eclair = new Groupes()
  let etincelles = ''
  for (let x = 0, i = 0; x < fin; x += c, i++) for (let j = 0; j < rows; j++) {
    const k = i * 37 + j * 101
    const b = bruit(k, o.graine)
    const rr = bruit(k * 3 + 1, o.graine)
    const t = x / Math.max(fin, 1)
    const w = Math.min(c, fin - x)
    let col = teinte(pal, t, o.fini, i, j)
    if (!o.fini && fin - x < 10) col = clair(col, 0.22 * (1 - (fin - x) / 10))
    const nouvelle = !o.fini && x >= finAvant
    const bord = boucles && !o.fini && !endormie && fin - x <= 2 * c // tête de lecture : les 2 dernières colonnes clignotent
    fond.case(col, bord ? `h${j}` : nouvelle ? `a${Math.floor(rr * 6)}` : '', x, j * c, w, c)
    if (nouvelle) sur.case('#FFFFFF', `b${Math.floor(rr * 6)}`, x, j * c, w, c)
    // Vague : l'ancienne couleur s'efface tranche par tranche, de gauche à droite ; à la fin du travail, un flash la suit.
    const pas = Math.min(PAS - 1, Math.floor(x / W * PAS))
    if (o.eclat || (o.niveauAvant !== o.niveau && x < finAvant)) sur.case(teinte(palAvant, t, false, i, j), `f${pas}`, x, j * c, w, c)
    if (o.eclat && j === 0) eclair.case('#FFFFFF', `w${pas}`, x, 0, w, H)
    if (boucles && !endormie && bruit(k * 7 + 3, o.graine) < 0.018) etincelles += `<rect class="e" x="${x}" y="${j * c}" width="${w}" height="${c}" fill="#FFFFFF" style="animation-delay:calc(var(--t) - ${(b * 1.6).toFixed(2)}s)"/>`
  }
  const cw = Math.round(Array.from(o.mot).length * 5.6) + 10
  const kx = Math.max(3, Math.min(W - cw - 3, fin - cw - 3))
  const kxAvant = Math.max(3, Math.min(W - cw - 3, finAvant - cw - 3))
  const glisse = kxAvant !== kx ? `animation:glisse .5s cubic-bezier(.34,1.56,.64,1) both;${retard(0)};` : ''
  // Tête de lecture : quelques pixels se détachent du bord vers la droite, tant que ça travaille.
  let fuite = ''
  if (boucles && !o.fini && !endormie && fin > 0 && fin < W - 6) {
    for (let n = 0; n < 4; n++) fuite += `<rect class="v" x="${fin}" y="${Math.min(H - c, ((n * 5) % rows) * c)}" width="${c}" height="${c}" fill="${pal[3]}" style="animation-delay:calc(var(--t) - ${(n * 0.33).toFixed(2)}s)"/>`
  }
  // Fanfare : confettis lancés en arc depuis le bout quand le flash l'atteint ; ils restent dans les 18 px de l'image.
  let gerbe = ''
  if (o.eclat) {
    for (let n = 0; n < 18; n++) {
      const dx = -(8 + bruit(n * 17 + 3, o.graine) * 48)
      const up = -(3 + bruit(n * 13 + 7, o.graine) * 4)
      const dy = 5 + bruit(n * 19 + 5, o.graine) * 5
      gerbe += `<rect class="g" x="${W - 10}" y="7" width="3" height="3" fill="${[...pal, ...palAvant][n % 8]}" style="--dx:${dx.toFixed(1)}px;--up:${up.toFixed(1)}px;--dy:${dy.toFixed(1)}px;${retard(800 + n * 14)}"/>`
    }
  }
  const vague = o.eclat || o.niveauAvant !== o.niveau
  const css = CSS_COMMUN(o.maintenant, o.majLe) + `
.a0,.a1,.a2,.a3,.a4,.a5{animation:apparait .26s ease-out both}.b0,.b1,.b2,.b3,.b4,.b5{animation:flash .26s ease-out both}
${RANGS(6).map(i => `.a${i},.b${i}{${retard(i * 44)}}`).join('')}
@keyframes apparait{from{opacity:0}to{opacity:1}}@keyframes flash{from{opacity:.55}to{opacity:0}}
${vague ? `${RANGS(PAS).map(i => `.f${i}`).join(',')}{animation:fond .3s ease both}${RANGS(PAS).map(i => `.w${i}`).join(',')}{opacity:0;animation:eclair .35s ease-out forwards}
${RANGS(PAS).map(i => `.f${i},.w${i}{${retard(i * 15)}}`).join('')}
@keyframes fond{from{opacity:1}to{opacity:0}}@keyframes eclair{from{opacity:.75}to{opacity:0}}` : ''}
${RANGS(6).map(j => `.h${j}{animation:clignote .9s ease-in-out infinite;animation-delay:calc(var(--t) - ${(j * 0.07).toFixed(2)}s)}`).join('')}
@keyframes clignote{0%,100%{opacity:1}50%{opacity:.2}}
.v{opacity:0;animation:fuite 1.3s ease-out infinite}@keyframes fuite{from{transform:none;opacity:.9}to{transform:translateX(22px);opacity:0}}
.z{opacity:.6}${boucles ? '.z{animation:dort 3.4s ease-in-out infinite;animation-delay:var(--t)}@keyframes dort{0%,100%{opacity:.9}50%{opacity:.4}}' : ''}
.k{transform:translateX(${kx}px);${glisse}}@keyframes glisse{from{transform:translateX(${kxAvant}px)}to{transform:translateX(${kx}px)}}
.pop{transform-origin:${cw / 2}px 9px;animation:pop .5s cubic-bezier(.34,1.56,.64,1);${retard(0)}}@keyframes pop{0%{transform:scale(.7)}60%{transform:scale(1.1)}100%{transform:scale(1)}}
.g{opacity:0;animation:gerbe .9s ease-out forwards}@keyframes gerbe{0%{transform:none;opacity:1}45%{transform:translate(calc(var(--dx) * .55),var(--up));opacity:1}100%{transform:translate(var(--dx),var(--dy));opacity:0}}`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<style>${css}</style>` +
    `<defs><clipPath id="p"><rect width="${W}" height="${H}" rx="7"/></clipPath><clipPath id="q"><rect width="${fin}" height="${H}"/></clipPath></defs>` +
    `<rect width="${W}" height="${H}" rx="7" fill="rgba(128,128,128,.12)" stroke="rgba(128,128,128,.35)" stroke-width=".5"/>` +
    `<g clip-path="url(#p)" shape-rendering="crispEdges">${endormie ? `<g class="z">${fond.svg()}</g>` : fond.svg()}${sur.svg()}${eclair.svg()}${etincelles}${fuite}<g clip-path="url(#q)">${o.fini || endormie || !boucles ? '' : reflet(fin, H, c)}</g></g>` +
    gerbe +
    `<g class="k"><g${o.eclat ? ' class="pop"' : ''}><rect y="3" width="${cw}" height="12" rx="3" fill-opacity=".8" fill="${pal[3]}" stroke="rgba(255,255,255,.3)" stroke-width=".5"/>` +
    `<text x="5" y="9.5" dominant-baseline="middle" fill="#FFFFFF" font-size="10" font-weight="600" font-family="Segoe UI, system-ui, sans-serif">${echapper(o.mot)}</text></g></g>` +
    `</svg>`
}

const LIMITE = 125000

export function svgFil(o: OptionsFil): string {
  // coupées : la barre est dessinée comme si rien ne venait de changer (ni colonnes neuves, ni vague, ni fanfare)
  const p = o.animations === 'coupees' ? { ...o, avant: o.fini ? 1 : o.progression, niveauAvant: o.niveau, eclat: false } : o
  return memoise(JSON.stringify({ ...p, maintenant: 0, endormie: assoupie(p) }), () => {
    let s = ''
    for (const c of [3, 4, 5, 6, 8]) {
      s = dessinerFil(p, c)
      if (s.length < LIMITE) return s
    }
    return s
  })
}

export type OptionsSimple = {
  largeur: number; hauteur: number; cellule: number; rayon: number
  progression: number; palette: readonly string[]; graine: number; maintenant: number
  titre?: string // info-bulle au survol (l'élément Svg interactif affiche les <title>)
  alerte?: boolean // jauge critique : double battement blanc sur la partie remplie
  animations?: Animations // absent : complètes
}
const CSS_ALERTE = '.c{opacity:0;animation:coeur 1.6s ease-in-out infinite;animation-delay:var(--t)}@keyframes coeur{0%,40%,100%{opacity:0}10%,30%{opacity:.4}20%{opacity:.05}}'

function dessinerSimple(o: OptionsSimple, c: number): string {
  const W = Math.max(20, Math.round(o.largeur))
  const H = o.hauteur
  const rows = Math.floor(H / c)
  const fin = Math.round(Math.max(0, Math.min(1, o.progression)) * W)
  const boucles = enBoucle(o.animations)
  const alerte = o.alerte && boucles
  const fond = new Groupes()
  for (let x = 0, i = 0; x < fin; x += c, i++) for (let j = 0; j < rows; j++) {
    fond.case(teinte(o.palette, x / Math.max(fin, 1), false, i, j), '', x, j * c, Math.min(c, fin - x), c)
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    (o.titre ? `<title>${echapper(o.titre)}</title>` : '') +
    `<style>${CSS_COMMUN(o.maintenant, o.maintenant)}${alerte ? CSS_ALERTE : ''}</style>` +
    `<defs><clipPath id="p"><rect width="${W}" height="${H}" rx="${o.rayon}"/></clipPath><clipPath id="q"><rect width="${fin}" height="${H}"/></clipPath></defs>` +
    `<rect width="${W}" height="${H}" rx="${o.rayon}" fill="rgba(128,128,128,.12)" stroke="rgba(128,128,128,.35)" stroke-width=".5"/>` +
    `<g clip-path="url(#p)" shape-rendering="crispEdges">${fond.svg()}<g clip-path="url(#q)">${boucles ? reflet(fin, H, c) : ''}</g>${alerte ? `<rect class="c" width="${fin}" height="${H}" fill="#FFFFFF"/>` : ''}</g></svg>`
}

export function svgSimple(o: OptionsSimple): string {
  return memoise(JSON.stringify({ ...o, maintenant: 0 }), () => {
    let s = ''
    for (const c of [o.cellule, o.cellule + 1, o.cellule + 2, o.cellule * 3]) {
      s = dessinerSimple(o, c)
      if (s.length < LIMITE) return s
    }
    return s
  })
}

export function barreTexte(progression: number, largeur: number): string {
  const n = Math.round(Math.max(0, Math.min(1, progression)) * largeur)
  return '█'.repeat(n) + '░'.repeat(Math.max(0, largeur - n))
}

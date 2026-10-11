import type { Niveau } from '../types'
export type { Niveau } from '../types'

export const PALETTES_FIL: readonly (readonly string[])[] = [
  ['#B2A6EE', '#9687E4', '#7C6CDC', '#6452D0'],
  ['#84A8EC', '#6490E6', '#4678DC', '#2C60C8'],
  ['#5CC4BC', '#38B2AA', '#1E9C96', '#10827C'],
  ['#7CC280', '#58B060', '#3C9C48', '#288037'],
]
export const PALETTES_JAUGE = {
  violet: ['#B2A6EE', '#9687E4', '#7C6CDC', '#6452D0'],
  orange: ['#F5AA5F', '#EE9646', '#E8862A', '#D6761E'],
  rouge: ['#E66E6E', '#DE5A5A', '#D64545', '#C43737'],
} as const
export const TEXTE_NIVEAU: readonly string[] = ['#5B4BC4', '#2C5FC0', '#0F7C76', '#2F7A3B']

const B4 = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]] as const
const EPS = 1e-6

export function niveauDe(progression: number, fini: boolean): Niveau {
  if (fini) return 3
  if (progression < 1 / 3 - EPS) return 0
  if (progression < 2 / 3 - EPS) return 1
  return 2
}

export function couleurJauge(pct: number): 'violet' | 'orange' | 'rouge' {
  return pct >= 90 ? 'rouge' : pct >= 75 ? 'orange' : 'violet'
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
function sombre(hex: string, k: number): string {
  return versHex(rgb(hex).map(v => v * (1 - k)))
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

function teinte(palette: readonly string[], t: number, fini: boolean, i: number, j: number, rows: number): string {
  const g = (fini ? 0.55 : 0.15 + 0.75 * t) * 3
  const lo = Math.floor(g)
  const fr = g - lo
  const idx = Math.min(3, fr * 16 > B4[i % 4]![j % 4]! ? lo + 1 : lo)
  let c = palette[idx]!
  if (j === 0) c = clair(c, 0.16)
  else if (j === rows - 1) c = sombre(c, 0.12)
  return c
}

const CSS_COMMUN = (t: number) => `svg{--t:${(-t / 1000).toFixed(2)}s}
.s0,.s1,.s2,.s3,.s4,.s5,.s6,.s7{animation:respire ease-in-out infinite}
.s0{animation-duration:1.2s;animation-delay:calc(var(--t) - .1s)}.s1{animation-duration:1.4s;animation-delay:calc(var(--t) - .7s)}
.s2{animation-duration:1.6s;animation-delay:calc(var(--t) - .3s)}.s3{animation-duration:1.8s;animation-delay:calc(var(--t) - 1.1s)}
.s4{animation-duration:2s;animation-delay:calc(var(--t) - .5s)}.s5{animation-duration:2.3s;animation-delay:calc(var(--t) - 1.6s)}
.s6{animation-duration:2.5s;animation-delay:calc(var(--t) - .9s)}.s7{animation-duration:2.8s;animation-delay:calc(var(--t) - 2s)}
@keyframes respire{0%,100%{opacity:1}50%{opacity:.86}}
.e{opacity:0;animation:etincelle 1.6s ease-in-out infinite}
@keyframes etincelle{0%,35%,65%,100%{opacity:0}50%{opacity:.85}}
.r{animation:reflet 4.6s ease-in-out infinite;animation-delay:var(--t)}
@media (prefers-reduced-motion: reduce){.s0,.s1,.s2,.s3,.s4,.s5,.s6,.s7,.r,.e,.g,.k,.pop,.a0,.a1,.a2,.a3,.a4,.a5{animation:none}.e,.r,.g,.b0,.b1,.b2,.b3,.b4,.b5{display:none}}`

// Reflet : une bande tramée de pixels blancs, en biais, qui traverse la partie remplie.
function reflet(fin: number, h: number, c: number): string {
  if (fin < c * 4) return ''
  const bw = Math.max(18, Math.round(fin * 0.07))
  const g = new Groupes()
  const rows = Math.floor(h / c)
  for (let x = 0; x < bw; x += c) for (let j = 0; j < rows; j++) {
    const u = x + j // pente
    const k2 = 1 - Math.abs(u - bw / 2) / (bw / 2)
    if (k2 > 0 && k2 * 16 > B4[(x / c) % 4]![j % 4]! * 0.9) g.case('#FFFFFF', '', x, j * c, c, c)
  }
  return `<style>@keyframes reflet{from{transform:translateX(${-bw}px)}to{transform:translateX(${fin}px)}}</style>` +
    `<g class="r">${g.svg(' fill-opacity=".45"')}</g>`
}

export type OptionsFil = {
  largeur: number; progression: number; avant: number; niveau: Niveau; niveauAvant: Niveau
  fini: boolean; eclat: boolean; mot: string; graine: number; majLe: number
}

function dessinerFil(o: OptionsFil, c: number): string {
  const W = Math.max(40, Math.round(o.largeur))
  const H = 22
  const rows = 7
  const pal = PALETTES_FIL[o.niveau]!
  const palAvant = PALETTES_FIL[o.niveauAvant]!
  const fin = o.fini ? W : Math.round(Math.max(0, Math.min(1, o.progression)) * W)
  const finAvant = Math.round(Math.max(0, Math.min(1, o.avant)) * W)
  const fond = new Groupes()
  const sur = new Groupes()
  let etincelles = ''
  for (let x = 0, i = 0; x < fin; x += c, i++) for (let j = 0; j < rows; j++) {
    const k = i * 37 + j * 101
    const b = bruit(k, o.graine)
    const rr = bruit(k * 3 + 1, o.graine)
    const t = x / Math.max(fin, 1)
    const w = Math.min(c, fin - x)
    let col = teinte(pal, t, o.fini, i, j, rows)
    if (!o.fini && fin - x < 10) col = clair(col, 0.22 * (1 - (fin - x) / 10))
    const nouvelle = !o.fini && x >= finAvant
    fond.case(col, nouvelle ? `a${Math.floor(rr * 6)}` : `s${Math.floor(bruit(k + 5, o.graine) * 8)}`, x, j * c, w, c)
    if (nouvelle) sur.case('#FFFFFF', `b${Math.floor(rr * 6)}`, x, j * c, w, c)
    if (o.eclat) sur.case(teinte(palAvant, t, false, i, j, rows), `f${Math.min(9, Math.floor((x / W * 450 + rr * 160) / 61))}`, x, j * c, w, c)
    else if (o.niveauAvant !== o.niveau && x < finAvant) sur.case(teinte(palAvant, t, false, i, j, rows), `d${Math.floor(rr * 6)}`, x, j * c, w, c)
    if (bruit(k * 7 + 3, o.graine) < 0.018) etincelles += `<rect class="e" x="${x}" y="${j * c}" width="${w}" height="${c}" fill="#FFFFFF" style="animation-delay:${(-b * 1.6).toFixed(2)}s"/>`
  }
  const cw = Math.round(Array.from(o.mot).length * 6.2) + 12
  const kx = Math.max(3, Math.min(W - cw - 3, fin - cw - 3))
  const kxAvant = Math.max(3, Math.min(W - cw - 3, finAvant - cw - 3))
  const glisse = kxAvant !== kx ? `animation:glisse .5s cubic-bezier(.34,1.56,.64,1) both;` : ''
  let gerbe = ''
  if (o.eclat) {
    for (let n = 0; n < 16; n++) {
      const a = bruit(n * 13 + 7, o.graine) * Math.PI * 2
      const s = 6 + bruit(n * 17 + 3, o.graine) * 10
      gerbe += `<rect class="g" x="${W - 10}" y="9" width="3" height="3" fill="${pal[n % 4]}" style="--dx:${(Math.cos(a) * s).toFixed(1)}px;--dy:${(Math.sin(a) * s * 0.7).toFixed(1)}px;animation-delay:${n * 12}ms"/>`
    }
  }
  const css = CSS_COMMUN(o.majLe) + `
.a0,.a1,.a2,.a3,.a4,.a5{animation:apparait .26s ease-out both}.b0,.b1,.b2,.b3,.b4,.b5{animation:flash .26s ease-out both}
.a0,.b0{animation-delay:0ms}.a1,.b1{animation-delay:44ms}.a2,.b2{animation-delay:88ms}.a3,.b3{animation-delay:132ms}.a4,.b4{animation-delay:176ms}.a5,.b5{animation-delay:220ms}
@keyframes apparait{from{opacity:0}to{opacity:1}}@keyframes flash{from{opacity:.55}to{opacity:0}}
.d0,.d1,.d2,.d3,.d4,.d5,.f0,.f1,.f2,.f3,.f4,.f5,.f6,.f7,.f8,.f9{animation:fond .3s ease both}
.d1{animation-delay:130ms}.d2{animation-delay:260ms}.d3{animation-delay:390ms}.d4{animation-delay:520ms}.d5{animation-delay:650ms}
.f1{animation-delay:61ms}.f2{animation-delay:122ms}.f3{animation-delay:183ms}.f4{animation-delay:244ms}.f5{animation-delay:305ms}.f6{animation-delay:366ms}.f7{animation-delay:427ms}.f8{animation-delay:488ms}.f9{animation-delay:549ms}
@keyframes fond{from{opacity:1}to{opacity:0}}
.k{transform:translateX(${kx}px);${glisse}}@keyframes glisse{from{transform:translateX(${kxAvant}px)}to{transform:translateX(${kx}px)}}
.pop{transform-origin:${cw / 2}px 7px;animation:pop .5s cubic-bezier(.34,1.56,.64,1)}@keyframes pop{0%{transform:scale(.7)}60%{transform:scale(1.1)}100%{transform:scale(1)}}
.g{animation:gerbe .7s ease-out both}@keyframes gerbe{from{transform:none;opacity:1}to{transform:translate(var(--dx),var(--dy));opacity:0}}`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<style>${css}</style>` +
    `<defs><clipPath id="p"><rect width="${W}" height="${H}" rx="7"/></clipPath><clipPath id="q"><rect width="${fin}" height="${H}"/></clipPath></defs>` +
    `<rect width="${W}" height="${H}" rx="7" fill="rgba(128,128,128,.12)" stroke="rgba(128,128,128,.35)" stroke-width=".5"/>` +
    `<g clip-path="url(#p)">${fond.svg()}${sur.svg()}${etincelles}<g clip-path="url(#q)">${o.fini ? '' : reflet(fin, H, c)}</g></g>` +
    gerbe +
    `<g class="k"><g${o.eclat ? ' class="pop"' : ''}><rect y="4" width="${cw}" height="14" rx="4" fill="${pal[3]}" stroke="rgba(255,255,255,.4)" stroke-width=".5"/>` +
    `<text x="6" y="11.5" dominant-baseline="middle" fill="#FFFFFF" font-size="11" font-weight="600" font-family="Segoe UI, system-ui, sans-serif">${echapper(o.mot)}</text></g></g>` +
    `</svg>`
}

const LIMITE = 125000

export function svgFil(o: OptionsFil): string {
  let s = ''
  for (const c of [3, 4, 5, 6, 8]) {
    s = dessinerFil(o, c)
    if (s.length < LIMITE) return s
  }
  return s
}

export type OptionsSimple = {
  largeur: number; hauteur: number; cellule: number; rayon: number
  progression: number; palette: readonly string[]; graine: number; majLe: number
  titre?: string // info-bulle au survol (l'élément Svg interactif affiche les <title>)
}

function dessinerSimple(o: OptionsSimple, c: number): string {
  const W = Math.max(20, Math.round(o.largeur))
  const H = o.hauteur
  const rows = Math.floor(H / c)
  const fin = Math.round(Math.max(0, Math.min(1, o.progression)) * W)
  const fond = new Groupes()
  for (let x = 0, i = 0; x < fin; x += c, i++) for (let j = 0; j < rows; j++) {
    const k = i * 37 + j * 101
    fond.case(teinte(o.palette, x / Math.max(fin, 1), false, i, j, rows), `s${Math.floor(bruit(k + 5, o.graine) * 8)}`, x, j * c, Math.min(c, fin - x), c)
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    (o.titre ? `<title>${echapper(o.titre)}</title>` : '') +
    `<style>${CSS_COMMUN(o.majLe)}</style>` +
    `<defs><clipPath id="p"><rect width="${W}" height="${H}" rx="${o.rayon}"/></clipPath><clipPath id="q"><rect width="${fin}" height="${H}"/></clipPath></defs>` +
    `<rect width="${W}" height="${H}" rx="${o.rayon}" fill="rgba(128,128,128,.12)" stroke="rgba(128,128,128,.35)" stroke-width=".5"/>` +
    `<g clip-path="url(#p)">${fond.svg()}<g clip-path="url(#q)">${reflet(fin, H, c)}</g></g></svg>`
}

export function svgSimple(o: OptionsSimple): string {
  let s = ''
  for (const c of [o.cellule, o.cellule + 1, o.cellule + 2, o.cellule * 3]) {
    s = dessinerSimple(o, c)
    if (s.length < LIMITE) return s
  }
  return s
}

export function barreTexte(progression: number, largeur: number): string {
  const n = Math.round(Math.max(0, Math.min(1, progression)) * largeur)
  return '█'.repeat(n) + '░'.repeat(Math.max(0, largeur - n))
}

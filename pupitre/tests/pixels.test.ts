import { describe, expect, test } from 'claude-code/testing'
import { PALETTES_FIL, barreTexte, couleurJauge, echapper, graineDe, niveauDe, svgFil, svgSimple } from '../hooks/pixels'

const BASE = { largeur: 600, progression: 0.5, avant: 0.5, niveau: 1 as const, niveauAvant: 1 as const, fini: false, eclat: false, mot: 'Lecture', graine: 3, majLe: 1000, maintenant: 1000 }

describe('niveaux et couleurs', () => {
  test('1/3 et 2/3 exacts donnent le niveau supérieur, une seule fois', async () => {
    expect(niveauDe(0, false)).toBe(0)
    expect(niveauDe(1 / 3, false)).toBe(1)
    expect(niveauDe(1 / 3 - 0.001, false)).toBe(0)
    expect(niveauDe(2 / 3, false)).toBe(2)
    expect(niveauDe(0.99, false)).toBe(2)
    expect(niveauDe(1, true)).toBe(3)
    expect(niveauDe(0.2, true)).toBe(3)
  })
  test('seuils de la jauge', async () => {
    expect(couleurJauge(0)).toBe('vert')
    expect(couleurJauge(49.9)).toBe('vert')
    expect(couleurJauge(50)).toBe('jaune')
    expect(couleurJauge(74.9)).toBe('jaune')
    expect(couleurJauge(75)).toBe('orange')
    expect(couleurJauge(89.9)).toBe('orange')
    expect(couleurJauge(90)).toBe('rouge')
  })
})

describe('svgFil', () => {
  test('produit un SVG valide qui contient la couleur du niveau et le mot', async () => {
    const s = svgFil(BASE)
    expect(s.startsWith('<svg')).toBe(true)
    expect(s.endsWith('</svg>')).toBe(true)
    expect(s).toContain(PALETTES_FIL[1]![3]!)
    expect(s).toContain('>Lecture<')
  })
  test('fini : couleurs vertes', async () => {
    const s = svgFil({ ...BASE, progression: 1, avant: 1, niveau: 3, niveauAvant: 3, fini: true, mot: '✓ Fini' })
    expect(s).toContain(PALETTES_FIL[3]![3]!)
    expect(s).not.toContain(PALETTES_FIL[1]![3]!)
  })
  test('échappe le texte du curseur', async () => {
    const s = svgFil({ ...BASE, mot: 'a<b & "c"' })
    expect(s).toContain('a&lt;b &amp; &quot;c&quot;')
    expect(s).not.toContain('a<b')
  })
  test('le même état donne exactement le même SVG (aucun recalcul inutile)', async () => {
    expect(svgFil(BASE)).toBe(svgFil(BASE))
  })
  test('d une seconde à l autre, une image inchangée garde le même texte : le bureau n a rien à recharger', async () => {
    expect(svgFil({ ...BASE, majLe: 7000, maintenant: 8000 })).toBe(svgFil({ ...BASE, majLe: 7000, maintenant: 9000 }))
    const jauge = { largeur: 160, hauteur: 10, cellule: 2, rayon: 4, progression: 0.3, palette: PALETTES_FIL[1]!, graine: 2, maintenant: 8000 }
    expect(svgSimple({ ...jauge, maintenant: 9000 })).toBe(svgSimple(jauge))
  })
  test('reste sous 125 000 caractères même très large, avec fondu et éclat', async () => {
    for (const largeur of [300, 900, 1600, 2600]) {
      const s = svgFil({ ...BASE, largeur, progression: 1, avant: 0, niveau: 3, niveauAvant: 2, fini: true, eclat: true })
      expect(s.length).toBeLessThan(125000)
    }
  })
  test('barre vide : aucune case pleine, curseur collé à gauche', async () => {
    const s = svgFil({ ...BASE, progression: 0, avant: 0, niveau: 0, niveauAvant: 0 })
    expect(s).toContain('translateX(3px)')
  })
  test('respecte la demande de moins d animations', async () => {
    expect(svgFil(BASE)).toContain('prefers-reduced-motion')
  })
  test('redessinée, l image reprend ses animations où elles en étaient, sans revenir en arrière', async () => {
    for (const o of [{ ...BASE, avant: 0.2 }, { ...BASE, progression: 1, avant: 0.6, niveau: 3 as const, niveauAvant: 2 as const, fini: true, eclat: true }]) {
      const s = svgFil({ ...o, majLe: 10_000, maintenant: 11_000 })
      expect(s).toContain('--t:-11.00s') // boucles (reflet, respiration, étincelles) : calées sur l'heure du dessin
      expect(s).toContain('--u:-1.00s') // effets d'un changement (cases neuves, curseur, éclat) : calés sur l'heure du changement
      expect(s).not.toMatch(/animation-delay:\s*-?[\d.]+m?s/) // aucun délai figé, qui repartirait de zéro à chaque dessin
    }
  })
})

describe('animations : attente, tête de lecture, vague, fanfare, alerte', () => {
  const FINI = { ...BASE, progression: 1, avant: 0.6, niveau: 3 as const, niveauAvant: 2 as const, fini: true, eclat: true }
  test('tête de lecture : les pixels colorés du bord clignotent et lâchent des pixels, seulement pendant le travail', async () => {
    expect(svgFil(BASE)).toMatch(/<path class="h0" fill="#(?!FFFFFF)/)
    expect(svgFil(BASE)).toContain('class="v"')
    expect(svgFil({ ...FINI, eclat: false })).not.toMatch(/class="h\d"/)
  })
  test('en attente : rien de changé depuis 20 s, la barre s assoupit, sans reflet ni tête', async () => {
    const s = svgFil({ ...BASE, majLe: 0, maintenant: 20_000 })
    expect(s).toContain('class="z"')
    expect(s).not.toContain('class="r"')
    expect(s).not.toMatch(/class="h\d"/)
    expect(svgFil({ ...BASE, majLe: 0, maintenant: 19_999 })).not.toContain('class="z"')
    expect(svgFil({ ...FINI, majLe: 0, maintenant: 60_000 })).not.toContain('class="z"')
  })
  test('vague de couleur : au changement de niveau, l ancienne couleur part de gauche à droite', async () => {
    const s = svgFil({ ...BASE, progression: 0.7, avant: 0.5, niveau: 2, niveauAvant: 1 })
    expect(s).toContain('class="f0"')
    expect(s).not.toMatch(/class="d\d"/)
  })
  test('fin en fanfare : un flash suit la vague jusqu au bout, puis des confettis en arc', async () => {
    expect(svgFil(FINI)).toContain('class="w0"')
    expect(svgFil(FINI)).toContain('class="w59"')
    expect(svgFil(FINI)).toContain('--up:')
    expect(svgFil({ ...FINI, eclat: false })).not.toContain('class="w0"')
  })
  test('jauge critique : battement de cœur seulement en alerte', async () => {
    const o = { largeur: 200, hauteur: 10, cellule: 2, rayon: 4, progression: 0.93, palette: PALETTES_FIL[0]!, graine: 1, maintenant: 0 }
    expect(svgSimple({ ...o, alerte: true })).toContain('class="c"')
    expect(svgSimple(o)).not.toContain('class="c"')
  })
})

describe('rendu comme la maquette : pixels nets, bande de lumière, étiquette discrète', () => {
  const JAUGE = { largeur: 200, hauteur: 10, cellule: 2, rayon: 4, progression: 0.6, palette: PALETTES_FIL[0]!, graine: 1, maintenant: 0 }
  test('pixels nets et opaques : bords francs, plus de respiration transparente', async () => {
    for (const s of [svgFil(BASE), svgSimple(JAUGE)]) {
      expect(s).toContain('shape-rendering="crispEdges"')
      expect(s).not.toContain('respire')
    }
  })
  test('éclat : une bande de lumière balaie la partie remplie pixel par pixel, puis marque une pause', async () => {
    for (const s of [svgFil(BASE), svgSimple(JAUGE)]) expect(s).toMatch(/animation:reflet \d+ms steps\(\d+\)/)
  })
  test('étiquette discrète : plus petite et un peu transparente', async () => {
    expect(svgFil(BASE)).toContain('height="12" rx="3" fill-opacity=".8"')
  })
})

describe('svgSimple et texte', () => {
  test('jauge pleine et sous la limite', async () => {
    const s = svgSimple({ largeur: 400, hauteur: 10, cellule: 2, rayon: 4, progression: 0.93, palette: ['#E66E6E', '#DE5A5A', '#D64545', '#C43737'], graine: 1, maintenant: 11_000 })
    expect(s).toContain('#D64545')
    expect(s).toContain('--t:-11.00s')
    expect(s.length).toBeLessThan(125000)
  })
  test('barre en caractères pour le terminal', async () => {
    expect(barreTexte(0.5, 10)).toBe('█████░░░░░')
    expect(barreTexte(0, 4)).toBe('░░░░')
    expect(barreTexte(1, 4)).toBe('████')
  })
  test('échapper et graine', async () => {
    expect(echapper('<&>"')).toBe('&lt;&amp;&gt;&quot;')
    expect(graineDe('claude')).toBe(graineDe('claude'))
    expect(graineDe('claude')).not.toBe(graineDe('agent-2'))
  })
})

test('svgSimple : info-bulle échappée quand un titre est donné', async () => {
  const o = { largeur: 120, hauteur: 10, cellule: 2, rayon: 4, progression: 0.4, palette: PALETTES_FIL[0]!, graine: 1, maintenant: 0 }
  expect(svgSimple(o)).not.toContain('<title>')
  expect(svgSimple({ ...o, titre: 'Limite 5 h : <remise> & co' })).toContain('<title>Limite 5 h : &lt;remise&gt; &amp; co</title>')
})

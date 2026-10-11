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

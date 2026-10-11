import { describe, expect, test } from 'claude-code/testing'
import { autresActives, ficheDe, lireFiche, nomFichier, titreDe } from '../hooks/partage'
import type { LigneFil } from '../types'

const L: LigneFil = { id: 'claude', qui: 'Claude', tache: 'Tâche 2 · B', mot: 'Lecture', compteur: '1 / 3', progression: 1 / 3, avant: 0, niveau: 1, niveauAvant: 0, fini: false, eclat: false, debut: 100, majLe: 900, finiLe: null }

describe('partage', () => {
  test('fiche écrite puis relue', async () => {
    const f = ficheDe('s1', 'REX AT', L, 1000)
    expect(lireFiche(JSON.stringify(f))).toEqual(f)
    expect(f.actif).toBe(true)
  })
  test('sans ligne Claude, ou ligne finie : inactive', async () => {
    expect(ficheDe('s1', 'X', undefined, 1000).actif).toBe(false)
    expect(ficheDe('s1', 'X', { ...L, fini: true }, 1000).actif).toBe(false)
  })
  test('fichier vide, à moitié écrit ou faux : ignoré', async () => {
    expect(lireFiche('')).toBe(null)
    expect(lireFiche('{"id":"s1","titre":')).toBe(null)
    expect(lireFiche('{"id":3}')).toBe(null)
    expect(lireFiche('[]')).toBe(null)
  })
  test('seules les autres sessions actives et récentes sont gardées, les plus anciennes en premier', async () => {
    const a = ficheDe('a', 'A', { ...L, debut: 50 }, 10_000)
    const b = ficheDe('b', 'B', { ...L, debut: 10 }, 10_000)
    const vieille = ficheDe('c', 'C', L, 1_000)
    const moi = ficheDe('moi', 'Moi', L, 10_000)
    const r = autresActives([a, null, b, vieille, moi], 'moi', 20_000)
    expect(r.map(x => x.id)).toEqual(['b', 'a'])
  })
  test('nom de fichier sûr et titre', async () => {
    expect(nomFichier('abc/../d:e')).toBe('abc____d_e.json')
    expect(titreDe('C:\\Users\\x\\Desktop\\Coding\\REX AT')).toBe('REX AT')
    expect(titreDe('/home/x/projet/')).toBe('projet')
  })
})

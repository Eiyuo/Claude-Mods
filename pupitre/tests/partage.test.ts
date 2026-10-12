import { describe, expect, test } from 'claude-code/testing'
import { ficheDe, lireFiche, nomFichier, suivreAutres, titreDe } from '../hooks/partage'
import type { LigneFil } from '../types'

const L: LigneFil = { id: 'claude', qui: 'Claude', tache: 'Tâche 2 · B', mot: 'Lecture', compteur: '1 / 3', progression: 1 / 3, avant: 0, niveau: 1, niveauAvant: 0, fini: false, eclat: false, attente: false, debut: 100, majLe: 900, finiLe: null }

test('l attente d une réponse passe d une fenêtre à l autre ; une fiche d une version précédente se relit sans', async () => {
  expect(lireFiche(JSON.stringify(ficheDe('a', 'T', { ...L, attente: true }, 1000)))!.attente).toBe(true)
  expect(lireFiche(JSON.stringify(ficheDe('a', 'T', { ...L, attente: true, fini: true, finiLe: 900 }, 1000)))!.attente).toBe(false)
  const { attente: _, ...ancienne } = ficheDe('a', 'T', L, 1000)
  expect(lireFiche(JSON.stringify(ancienne))!.attente).toBe(false)
  expect(suivreAutres([], [ficheDe('a', 'T', { ...L, attente: true }, 1000)], 'moi', 1000)[0]!.attente).toBe(true)
})

test('l étape (six couleurs, puis 6 pour la fin) passe d une fenêtre à l autre ; une étape inconnue revient à 0', async () => {
  for (const niveau of [5, 6] as const) expect(lireFiche(JSON.stringify(ficheDe('a', 'T', { ...L, niveau }, 1000)))!.niveau).toBe(niveau)
  expect(lireFiche(JSON.stringify({ ...ficheDe('a', 'T', L, 1000), niveau: 7 }))!.niveau).toBe(0)
})

describe('partage', () => {
  test('fiche écrite puis relue', async () => {
    const f = ficheDe('s1', 'Mon Projet', L, 1000)
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
    const r = suivreAutres([], [a, null, b, vieille, moi], 'moi', 20_000)
    expect(r.map(x => x.id)).toEqual(['b', 'a'])
  })
  const FINI: LigneFil = { ...L, fini: true, finiLe: 11_000, tache: 'Terminé', progression: 1 }
  test('une fiche finie garde son heure de fin ; celle d une version précédente se relit sans', async () => {
    expect(lireFiche(JSON.stringify(ficheDe('a', 'A', FINI, 12_000)))?.finiLe).toBe(11_000)
    const { finiLe: _, ...ancienne } = ficheDe('a', 'A', L, 1000)
    expect(lireFiche(JSON.stringify(ancienne))?.finiLe).toBe(null)
  })
  test('vue en cours puis finie : la ligne reste, fiche périmée ou effacée, jusqu à sa croix', async () => {
    const enCours = suivreAutres([], [ficheDe('a', 'A', L, 10_000)], 'moi', 10_000)
    expect(enCours.map(x => x.finiLe)).toEqual([null])
    const finie = suivreAutres(enCours, [ficheDe('a', 'A', FINI, 12_000)], 'moi', 12_000)
    expect(finie.map(x => [x.id, x.tache, x.finiLe])).toEqual([['a', 'Terminé', 11_000]])
    expect(suivreAutres(finie, [], 'moi', 600_000)).toEqual(finie) // fiche périmée, ou discussion fermée
    expect(suivreAutres(finie, [ficheDe('a', 'A', undefined, 13_000)], 'moi', 13_000)).toEqual(finie) // croix de l'autre discussion
    const fermee = finie.filter(x => x.id !== 'a') // croix d'ici : la fiche finie, encore fraîche, ne la ramène pas
    expect(suivreAutres(fermee, [ficheDe('a', 'A', FINI, 12_000)], 'moi', 14_000)).toEqual([])
    const relance = suivreAutres(fermee, [ficheDe('a', 'A', { ...L, debut: 20_000 }, 20_000)], 'moi', 20_000) // nouvelle demande là-bas
    expect(relance.map(x => x.finiLe)).toEqual([null])
  })
  test('finie sans avoir été vue en cours, ou disparue en plein travail : pas de ligne', async () => {
    expect(suivreAutres([], [ficheDe('a', 'A', FINI, 12_000)], 'moi', 12_000)).toEqual([])
    const enCours = suivreAutres([], [ficheDe('a', 'A', L, 10_000)], 'moi', 10_000)
    expect(suivreAutres(enCours, [], 'moi', 30_000)).toEqual([])
  })
  test('la fiche porte la demande (titre de la ligne) et le mot d étape ; une ancienne fiche se relit sans', async () => {
    const f = ficheDe('s1', 'X', { ...L, qui: 'Analyse le dossier', mot: 'Lecture' }, 1000)
    expect([f.demande, f.mot]).toEqual(['Analyse le dossier', 'Lecture'])
    const { demande: _d, mot: _m, ...ancienne } = f
    expect(lireFiche(JSON.stringify(ancienne))).toMatchObject({ demande: '', mot: '' })
  })
  test('nom de fichier sûr et titre', async () => {
    expect(nomFichier('abc/../d:e')).toBe('abc____d_e.json')
    expect(titreDe('C:\\Users\\x\\Desktop\\Coding\\Mon Projet')).toBe('Mon Projet')
    expect(titreDe('/home/x/projet/')).toBe('projet')
  })
})

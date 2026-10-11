import { describe, expect, test } from 'claude-code/testing'
import { appliquerAppel, debutTour, estimation, etape, finir, ligneDe, lignesGardees, motEtape, nouveauSuivi, vue } from '../hooks/fil'

describe('mots d étape', () => {
  test('outils connus, connecteurs, navigateur, inconnu', async () => {
    expect(motEtape('Read')).toBe('Lecture')
    expect(motEtape('Grep')).toBe('Recherche')
    expect(motEtape('Edit')).toBe('Écriture')
    expect(motEtape('Bash')).toBe('Commande')
    expect(motEtape('PowerShell')).toBe('Commande')
    expect(motEtape('Agent')).toBe('Délégation')
    expect(motEtape('WebFetch')).toBe('Web')
    expect(motEtape('AskUserQuestion')).toBe('Question')
    expect(motEtape('Skill')).toBe('Méthode')
    expect(motEtape('TaskCreate')).toBe('Organisation')
    expect(motEtape('mcp__Claude_Browser__navigate')).toBe('Web')
    expect(motEtape('mcp__abc__create_page')).toBe('Connecteur')
    expect(motEtape('UnOutilInconnu')).toBe('Action')
  })
})

describe('tâches', () => {
  test('TaskCreate puis TaskUpdate : avancement et tâche en cours', async () => {
    let s = nouveauSuivi(0)
    s = appliquerAppel(s, 'TaskCreate', { subject: 'Lire' }, { task: { id: '1', subject: 'Lire' } })
    s = appliquerAppel(s, 'TaskCreate', { subject: 'Écrire' }, { task: { id: '2', subject: 'Écrire' } })
    s = appliquerAppel(s, 'TaskCreate', { subject: 'Tester' }, { task: { id: '3', subject: 'Tester' } })
    s = appliquerAppel(s, 'TaskUpdate', { taskId: '1', status: 'completed' }, { success: true })
    s = appliquerAppel(s, 'TaskUpdate', { taskId: '2', status: 'in_progress' }, { success: true })
    const v = vue(s, 1000)
    expect(v.faites).toBe(1)
    expect(v.total).toBe(3)
    expect(v.compteur).toBe('1 / 3')
    expect(v.tache).toBe('Tâche 2 · Écrire')
    expect(v.progression).toBe(1 / 3)
  })
  test('TaskCreate sans résultat exploitable : id par ordre de création', async () => {
    let s = nouveauSuivi(0)
    s = appliquerAppel(s, 'TaskCreate', { subject: 'A' }, undefined)
    s = appliquerAppel(s, 'TaskUpdate', { taskId: '1', status: 'completed' }, undefined)
    expect(vue(s, 0).faites).toBe(1)
  })
  test('TaskUpdate deleted retire la tâche', async () => {
    let s = nouveauSuivi(0)
    s = appliquerAppel(s, 'TaskCreate', { subject: 'A' }, { task: { id: '7', subject: 'A' } })
    s = appliquerAppel(s, 'TaskUpdate', { taskId: '7', status: 'deleted' }, {})
    expect(vue(s, 0).total).toBe(0)
  })
  test('etape change le mot sans toucher aux tâches', async () => {
    const s = appliquerAppel(nouveauSuivi(0), 'TaskCreate', { subject: 'A' }, { task: { id: '1', subject: 'A' } })
    const t = etape(s, 'TaskCreate')
    expect(t.mot).toBe('Organisation')
    expect(t.taches.length).toBe(1)
  })
  test('TodoWrite remplace la liste', async () => {
    const s = appliquerAppel(nouveauSuivi(0), 'TodoWrite', { todos: [
      { content: 'A', status: 'completed', activeForm: 'a' },
      { content: 'B', status: 'in_progress', activeForm: 'b' },
    ] }, {})
    expect(vue(s, 0).compteur).toBe('1 / 2')
    expect(vue(s, 0).tache).toBe('Tâche 2 · B')
  })
  test('sans liste : estimation par pas de 5 %, jamais plus de 90 %', async () => {
    const s = nouveauSuivi(0)
    expect(vue(s, 0).progression).toBe(0)
    expect(vue(s, 0).compteur).toBe('≈')
    expect(vue(s, 3_600_000).progression).toBeLessThanOrEqual(0.9)
    expect(vue(s, 20_000).progression).toBe(Math.floor(estimation(20_000) * 20) / 20)
    expect(estimation(40_000)).toBeGreaterThan(0.5)
  })
  test('nouveau tour : une liste entièrement faite est oubliée, une liste en cours est gardée', async () => {
    let s = appliquerAppel(nouveauSuivi(0), 'TaskCreate', { subject: 'A' }, { task: { id: '1', subject: 'A' } })
    expect(debutTour(s, 10).taches.length).toBe(1)
    s = appliquerAppel(s, 'TaskUpdate', { taskId: '1', status: 'completed' }, {})
    expect(debutTour(s, 10).taches.length).toBe(0)
  })
  test('fin : 100 %, « Terminé · n tâches », mot « ✓ Fini »', async () => {
    let s = appliquerAppel(nouveauSuivi(0), 'TaskCreate', { subject: 'A' }, { task: { id: '1', subject: 'A' } })
    s = finir(s, 5000)
    const v = vue(s, 5000)
    expect(v.progression).toBe(1)
    expect(v.tache).toBe('Terminé · 1 tâche')
    expect(s.mot).toBe('✓ Fini')
  })
})

describe('lignes', () => {
  test('première apparition : part de 0, sans fondu de couleur', async () => {
    const l = ligneDe('claude', 'Claude', nouveauSuivi(0), 0, undefined)
    expect(l.avant).toBe(0)
    expect(l.niveauAvant).toBe(l.niveau)
    expect(l.eclat).toBe(false)
  })
  test('un changement de mot seul ne rejoue pas le glissement', async () => {
    let s = appliquerAppel(nouveauSuivi(0), 'TaskCreate', { subject: 'A' }, { task: { id: '1', subject: 'A' } })
    s = appliquerAppel(s, 'TaskCreate', { subject: 'B' }, { task: { id: '2', subject: 'B' } })
    s = appliquerAppel(s, 'TaskUpdate', { taskId: '1', status: 'completed' }, {})
    const l1 = ligneDe('claude', 'Claude', s, 100, undefined)
    const l2 = ligneDe('claude', 'Claude', appliquerAppel(s, 'Read', {}, {}), 200, l1)
    expect(l2.mot).toBe('Lecture')
    expect(l2.avant).toBe(l2.progression)
    expect(l2.majLe).toBe(200)
  })
  test('une tâche finie : glissement depuis l ancienne progression, et niveau stable à 1/3', async () => {
    let s = nouveauSuivi(0)
    for (const id of ['1', '2', '3']) s = appliquerAppel(s, 'TaskCreate', { subject: id }, { task: { id, subject: id } })
    const l0 = ligneDe('a', 'Sous-agent 1', s, 0, undefined)
    s = appliquerAppel(s, 'TaskUpdate', { taskId: '1', status: 'completed' }, {})
    const l1 = ligneDe('a', 'Sous-agent 1', s, 10, l0)
    expect(l1.avant).toBe(0)
    expect(l1.niveau).toBe(1)
    expect(l1.niveauAvant).toBe(0)
    const l2 = ligneDe('a', 'Sous-agent 1', appliquerAppel(s, 'Grep', {}, {}), 20, l1)
    expect(l2.niveau).toBe(1)
    expect(l2.niveauAvant).toBe(1)
  })
  test('fin : éclat une seule fois', async () => {
    const s = nouveauSuivi(0)
    const l0 = ligneDe('claude', 'Claude', s, 0, undefined)
    const l1 = ligneDe('claude', 'Claude', finir(s, 10), 10, l0)
    expect(l1.eclat).toBe(true)
    expect(l1.niveau).toBe(3)
    const l2 = ligneDe('claude', 'Claude', finir(s, 10), 20, l1)
    expect(l2.eclat).toBe(false)
  })
})

test('au rechargement du mod, les barres finies restent (avec leur croix), les barres en cours partent', async () => {
  const s = nouveauSuivi(0)
  const enCours = ligneDe('a1', 'Sous-agent 1', s, 1000, undefined)
  const finie = ligneDe('claude', 'Claude', finir(s, 2000), 2000, undefined)
  expect(lignesGardees([finie, enCours]).map(l => l.id)).toEqual(['claude'])
  expect(lignesGardees([])).toEqual([])
})

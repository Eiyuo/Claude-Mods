import { describe, expect, test } from 'claude-code/testing'
import { AUCUN, basculer, changerSeuil, jaugeVisible, lireAnimations, lireRelais, lireReglages, toutAllume } from '../hooks/reglages'

describe('réglages', () => {
  test('/pupitre allume tout quand tout est éteint', async () => {
    const r = basculer(AUCUN, 'pupitre')
    expect(toutAllume(r.reglages)).toBe(true)
    expect(r.message).toBe('Pupitre : tout est allumé')
  })
  test('/pupitre éteint tout quand tout est allumé', async () => {
    const tout = basculer(AUCUN, 'pupitre').reglages
    const r = basculer(tout, 'pupitre')
    expect(r.reglages).toEqual(AUCUN)
    expect(r.message).toBe('Pupitre : tout est éteint')
  })
  test('/pupitre allume tout quand une seule fonction est éteinte', async () => {
    const tout = basculer(AUCUN, 'pupitre').reglages
    const sansFil = basculer(tout, 'fil').reglages
    expect(toutAllume(basculer(sansFil, 'pupitre').reglages)).toBe(true)
  })
  test('une commande précise bascule seulement sa fonction, accordée en genre', async () => {
    const r = basculer(AUCUN, 'jauge')
    expect(r.reglages).toEqual({ ...AUCUN, jauge: true })
    expect(r.message).toBe('Pupitre : jauge allumée')
    expect(basculer(r.reglages, 'jauge').message).toBe('Pupitre : jauge éteinte')
    expect(basculer(AUCUN, 'fil').message).toBe('Pupitre : fil allumé')
    expect(basculer(AUCUN, 'relais').message).toBe('Pupitre : bouton « Passer le relais » allumé')
    expect(basculer(AUCUN, 'plume').message).toBe('Pupitre : bouton « Améliorer le prompt » allumé')
  })
  test('jamais réglé (première installation) : tout est allumé ; un choix enregistré, même « tout éteint », est respecté', async () => {
    expect(toutAllume(lireReglages(undefined))).toBe(true)
    expect(lireReglages(AUCUN)).toEqual(AUCUN)
  })
  test('lireReglages accepte n importe quoi et ne garde que des booléens vrais', async () => {
    expect(lireReglages('x')).toEqual(AUCUN)
    expect(lireReglages({ jauge: true, fil: 'oui', cap: 1 })).toEqual({ ...AUCUN, jauge: true })
  })
  test('la jauge s affiche aussi pour porter les boutons relais et plume', async () => {
    expect(jaugeVisible(AUCUN)).toBe(false)
    expect(jaugeVisible({ ...AUCUN, relais: true })).toBe(true)
    expect(jaugeVisible({ ...AUCUN, plume: true })).toBe(true)
    expect(jaugeVisible({ ...AUCUN, jauge: true })).toBe(true)
    expect(jaugeVisible({ ...AUCUN, fil: true })).toBe(true) // le bouton « Réglages » doit rester accessible
    expect(jaugeVisible({ ...AUCUN, cap: true })).toBe(true)
  })
  test('/cap allume ou éteint le cap automatique', async () => {
    expect(basculer(AUCUN, 'cap')).toEqual({ reglages: { ...AUCUN, cap: true }, message: 'Pupitre : cap automatique allumé' })
  })
  test('seuil du relais : 60 % par défaut, de 30 à 90 % par pas de 5', async () => {
    expect(lireRelais(undefined)).toEqual({ seuil: 60, auto: false })
    expect(lireRelais({ seuil: 75, auto: true })).toEqual({ seuil: 75, auto: true })
    expect(lireRelais({ seuil: 12, auto: 'oui' })).toEqual({ seuil: 30, auto: false })
    expect(lireRelais({ seuil: 99 })).toEqual({ seuil: 90, auto: false })
    expect(lireRelais({ seuil: 63 })).toEqual({ seuil: 65, auto: false })
    expect([changerSeuil(60, 1), changerSeuil(60, -1), changerSeuil(90, 1), changerSeuil(30, -1)]).toEqual([65, 55, 90, 30])
  })
  test('animations : complètes par défaut, un choix enregistré est respecté, le reste revient à complètes', async () => {
    expect(lireAnimations(undefined)).toBe('completes')
    expect(lireAnimations('reduites')).toBe('reduites')
    expect(lireAnimations('coupees')).toBe('coupees')
    expect(lireAnimations('rapides')).toBe('completes')
  })
})

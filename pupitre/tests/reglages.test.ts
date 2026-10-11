import { describe, expect, test } from 'claude-code/testing'
import { AUCUN, basculer, jaugeVisible, lireReglages, toutAllume } from '../hooks/reglages'

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
  test('lireReglages accepte n importe quoi et ne garde que des booléens vrais', async () => {
    expect(lireReglages(undefined)).toEqual(AUCUN)
    expect(lireReglages('x')).toEqual(AUCUN)
    expect(lireReglages({ jauge: true, fil: 'oui', cap: 1 })).toEqual({ ...AUCUN, jauge: true })
  })
  test('la jauge s affiche aussi pour porter les boutons relais et plume', async () => {
    expect(jaugeVisible(AUCUN)).toBe(false)
    expect(jaugeVisible({ ...AUCUN, relais: true })).toBe(true)
    expect(jaugeVisible({ ...AUCUN, plume: true })).toBe(true)
    expect(jaugeVisible({ ...AUCUN, jauge: true })).toBe(true)
    expect(jaugeVisible({ ...AUCUN, fil: true })).toBe(true) // le bouton « Réglages » doit rester accessible
  })
})

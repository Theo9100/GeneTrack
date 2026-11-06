import { describe, expect, it } from 'vitest'
import { chercher, delaiViandeJours, dosesParKg, type Medicament } from '../src/medicaments'

// Extraits réels de la base ANMV (RCP officiels)
const IVOMEC = "Voie sous-cutanée 0,2 mg d'ivermectine par kg de poids vif, soit 1 mL de solution pour 50 kg de poids vif, en une administration unique, dans un pli de peau, en avant ou en arrière de l'épaule."
const EPRINEX = 'Administration topique en une seule application à la dose de 500 µg d’éprinomectine par kg de poids vif, soit 1 mL par 10 kg de poids vif.Verser sur la ligne du dos de l’animal.'
const BIOVEINE = "Voie intraveineuse lente. 12,5 à 25 mg de calcium et 26,5 à 53 mg d'hypophosphite magnésium par kg de poids vif par administration, soit 0,5 mL à 1 mL par kg de poids vif par administration intraveineuse lente."
const THERACALCIUM = "Chez les bovins et les équins adultes :4 à 8 mg de calcium par kg de poids vif par administration, soit 0,1 mL à 0,2 ml par kg de poids vif.Soit un volume à administrer de 100 mL pour un bovin. Chez les porcins :2 à 4 mg de calcium par kg de poids vif par administration, soit 0,05 mL à 0,1 mL par kg de poids vif"
const BOVILIS = 'Injection intramusculaire. 1 dose de 2 mL par animal. Tous les bovins peuvent être vaccinés à partir de l’âge de 8 mois.'

const M = (nom: string, o: Partial<Medicament> = {}): Medicament => ({
  id: nom, nom, amm: '', maj: '', lien: '', forme: '', titulaire: '', substances: [], voies: [], attente: [], attenteTexte: '', especes: '', posologie: '', indications: '', contreIndications: '', ...o,
})

describe('doses par kg', () => {
  it('Ivomec : mg/kg et volume pour 50 kg', () => {
    const d = dosesParKg(IVOMEC)
    expect(d.map((x) => [x.quantite, x.unite])).toEqual([[0.2, 'mg'], [0.02, 'ml']])
    expect(d[1].texte).toBe('1 mL de solution pour 50 kg')
  })
  it('Eprinex : µg/kg et 1 mL par 10 kg', () => {
    expect(dosesParKg(EPRINEX).map((x) => [x.quantite, x.unite])).toEqual([[500, 'µg'], [0.1, 'ml']])
  })
  it('fourchettes', () => {
    const d = dosesParKg(BIOVEINE)
    expect(d.find((x) => x.unite === 'ml')).toMatchObject({ quantite: 0.5, max: 1 })
    expect(d.find((x) => x.max === 53)).toMatchObject({ quantite: 26.5, unite: 'mg' })
  })
  it('multi-espèces : indique l espèce et met les bovins en premier', () => {
    const d = dosesParKg(THERACALCIUM)
    expect(d[0]).toMatchObject({ bovin: true, quantite: 4, max: 8, unite: 'mg' })
    expect(d[0].espece).toBe('Bovins, Équins')
    const porc = d.find((x) => x.espece === 'Porcins')!
    expect(porc).toMatchObject({ bovin: false })
    expect(d.filter((x) => x.bovin).every((x) => d.indexOf(x) < d.indexOf(porc))).toBe(true)
  })
  it('dose fixe par animal : pas de calcul au poids', () => {
    expect(dosesParKg(BOVILIS)).toEqual([])
  })
})

describe('temps d attente et recherche', () => {
  it('délai viande en jours (plus long, heures arrondies, zéro)', () => {
    expect(delaiViandeJours(M('a', { attente: [{ denree: 'Viande et abats', valeur: '49 jours', voie: '' }, { denree: 'Lait', valeur: 'Ne pas utiliser', voie: '' }] }))).toBe(49)
    expect(delaiViandeJours(M('b', { attente: [{ denree: 'Viande et abats', valeur: 'Zéro jour', voie: '' }] }))).toBe(0)
    expect(delaiViandeJours(M('c', { attente: [{ denree: 'Viande et abats', valeur: '15 jours', voie: 'IM' }, { denree: 'Viande et abats', valeur: '28 jours', voie: 'SC' }] }))).toBe(28)
    expect(delaiViandeJours(M('d'))).toBeNull()
  })
  it('recherche sans accents, par nom ou substance', () => {
    const items = [M('IVOMEC SOLUTION INJECTABLE POUR BOVINS', { substances: ['Ivermectine'] }), M('EPRINEX POUR-ON POUR BOVINS', { substances: ['Eprinomectine'] }), M('BOVIVERM', { substances: ['Ivermectine'] })]
    expect(chercher(items, 'eprinex').map((m) => m.nom)).toEqual(['EPRINEX POUR-ON POUR BOVINS'])
    expect(chercher(items, 'ivermectine').map((m) => m.nom).sort()).toEqual(['BOVIVERM', 'IVOMEC SOLUTION INJECTABLE POUR BOVINS'])
    expect(chercher(items, 'éprinomectine').length).toBe(1)
    expect(chercher(items, 'ivomec inj').length).toBe(1)
  })
})

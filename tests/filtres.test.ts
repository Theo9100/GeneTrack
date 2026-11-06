import { describe, expect, it } from 'vitest'
import { FILTRES_DEFAUT, filtrer, filtresActifs, lignes, peres, type Filtres } from '../src/filtres'
import type { Animal, Data, Repro, Soin } from '../src/types'

const A = (id: string, o: Partial<Animal> = {}): Animal => ({
  id, updatedAt: 0, numero: 'FR' + id, travail: id, nom: '', sexe: 'F', naissance: '', mereId: '', pereId: '', pereTexte: '', statut: 'present', dateSortie: '', notes: '', ...o,
})
const today = '2026-11-06'
const data: Data = {
  animals: [
    A('10', { nom: 'Rosa', naissance: '2019-03-01' }),
    A('11', { nom: 'Lola', naissance: '2022-04-10' }),
    A('20', { nom: 'Titan', sexe: 'M', naissance: '2018-01-01' }),
    A('30', { nom: 'Veau1', naissance: '2026-03-02', mereId: '10', pereId: '20' }),
    A('31', { nom: 'Veau2', sexe: 'M', naissance: '2026-04-15', mereId: '11', pereTexte: 'IA Ingres' }),
    A('40', { nom: 'Vendue', naissance: '2021-02-02', statut: 'vendu' }),
  ],
  repros: [{ id: 'r', updatedAt: 0, vacheId: '10', type: 'saillie', date: '2026-05-01', taureauId: '20', taureauTexte: '', diagDate: '', diagResultat: 'pleine', velageId: '', notes: '' } as Repro],
  velages: [], mouvements: [], chaleurs: [], gest: 285,
  soins: [{ id: 's', updatedAt: 0, animalIds: ['11'], date: '2026-11-01', type: 'antibiotique', produit: 'X', dose: '', delaiJours: 28, rappelDate: '', rappelFait: false, notes: '' } as Soin],
}
const L = lignes(data, today)
const ids = (f: Partial<Filtres>, q = '') => filtrer(L, { ...FILTRES_DEFAUT, ...f }, q).map((l) => l.a.id)

describe('filtres des animaux', () => {
  it('filtre par année et période de naissance', () => {
    expect(ids({ annee: '2026' })).toEqual(['30', '31'])
    expect(ids({ neDu: '2022-01-01', neAu: '2026-03-31' })).toEqual(['11', '30'])
    expect(ids({ statut: '', neAu: '2021-12-31' })).toEqual(['10', '20', '40'])
  })
  it('filtre par mère et par père (troupeau ou extérieur)', () => {
    expect(ids({ mereId: '10' })).toEqual(['30'])
    expect(ids({ pere: '20' })).toEqual(['30'])
    expect(ids({ pere: 'ext:IA Ingres' })).toEqual(['31'])
    expect(peres(data.animals).map((p) => p.value)).toEqual(['20', 'ext:IA Ingres'])
  })
  it('filtre par état de reproduction et délai d attente', () => {
    expect(ids({ repro: 'pleine' })).toEqual(['10'])
    expect(ids({ repro: 'non-saillie' })).toEqual(['11']) // les veaux et mâles sont exclus
    expect(ids({ attente: true })).toEqual(['11'])
    expect(L.find((l) => l.a.id === '10')!.velage).toBe('2027-02-10')
  })
  it('trie et combine avec la recherche', () => {
    expect(ids({ tri: 'jeunes' })).toEqual(['31', '30', '11', '10', '20'])
    expect(ids({ tri: 'nom' }).slice(0, 2)).toEqual(['11', '10'])
    expect(ids({ tri: 'velage' })[0]).toBe('10')
    expect(ids({ sexe: 'F' }, 'veau')).toEqual(['30'])
  })
  it('résume les filtres actifs', () => {
    expect(filtresActifs({ ...FILTRES_DEFAUT, annee: '2026', pere: 'ext:IA Ingres', attente: true }, data.animals).map((x) => x.label))
      .toEqual(['Né(e)s en 2026', 'Père : IA Ingres', "Délai d'attente en cours"])
  })
})

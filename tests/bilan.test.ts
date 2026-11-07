import { describe, expect, it } from 'vitest'
import { aSurveiller, anneesBilan, bilan } from '../src/bilan'
import type { Animal, Data, Repro, Velage } from '../src/types'

const A = (id: string, o: Partial<Animal> = {}): Animal => ({
  id, updatedAt: 0, numero: 'FR' + id, travail: id, nom: '', sexe: 'F', naissance: '', mereId: '', pereId: '', pereTexte: '', statut: 'present', dateSortie: '', notes: '', ...o,
})
const V = (id: string, mereId: string, date: string, o: Partial<Velage> = {}): Velage => ({
  id, updatedAt: 0, mereId, date, veauId: '', sexe: 'F', facilite: 1, vigueur: 3, incidents: '', poids: 45, morNe: false, reproId: '', notes: '', ...o,
})
const R = (id: string, vacheId: string, date: string, o: Partial<Repro> = {}): Repro => ({
  id, updatedAt: 0, vacheId, type: 'saillie', date, taureauId: '', taureauTexte: '', diagDate: '', diagResultat: '', velageId: '', notes: '', ...o,
})

const data: Data = {
  animals: [
    A('rosa', { naissance: '2016-02-01' }),
    A('lola', { naissance: '2023-03-01' }), // primipare : 1er vêlage à 32 mois
    A('vieille', { naissance: '2012-01-01' }),
  ],
  velages: [
    V('v1', 'rosa', '2025-01-10'),
    V('v2', 'rosa', '2026-01-25', { sexe: 'M', poids: 51 }), // IVV 380 j
    V('v3', 'lola', '2025-11-05', { facilite: 3 }),
    V('v4', 'vieille', '2024-02-01', { facilite: 4 }),
    V('v5', 'vieille', '2026-02-20', { facilite: 3, morNe: true, poids: null }), // IVV 750 j
  ],
  repros: [
    R('r1', 'rosa', '2026-04-20', { diagResultat: 'pleine' }),
    R('r2', 'lola', '2026-05-01', { diagResultat: 'vide' }),
    R('r3', 'vieille', '2026-05-10', { diagResultat: 'vide' }),
    R('r4', 'vieille', '2026-07-01', { diagResultat: 'vide' }),
    R('r5', 'lola', '2026-07-01'),
  ],
  soins: [], mouvements: [], chaleurs: [], gest: 285,
}

describe('bilan de reproduction', () => {
  it('compte les vêlages de la campagne', () => {
    const b = bilan(data, '2026')
    expect(b).toMatchObject({ velages: 2, vivants: 1, mortNes: 1, males: 1, femelles: 1, difficiles: 1, cesariennes: 0, poidsMoyen: 51 })
    expect(b.parMois.slice(0, 3)).toEqual([1, 1, 0])
  })
  it('calcule l intervalle vêlage-vêlage', () => {
    const b = bilan(data, '2026')
    expect(b.ivvN).toBe(2)
    expect(b.ivvMoyen).toBe((380 + 750) / 2)
    expect(b.ivvLongs).toBe(1)
  })
  it('calcule l âge au premier vêlage (historique plausible seulement)', () => {
    expect(bilan(data, '2025')).toMatchObject({ primipares: 1, agePremierVelage: 32 }) // rosa (107 mois) est exclue
  })
  it('calcule le taux de gestation sur les diagnostics connus', () => {
    expect(bilan(data, '2026')).toMatchObject({ saillies: 5, diagnostiquees: 4, pleines: 1, tauxGestation: 25 })
  })
  it('liste les années disponibles', () => {
    expect(anneesBilan(data, '2026-11-07')).toEqual(['2026', '2025', '2024'])
  })
})

describe('vaches à surveiller', () => {
  it('signale les raisons de réforme possibles', () => {
    const l = aSurveiller(data, '2026-11-07')
    expect(l.map((x) => x.a.id)).toEqual(['vieille'])
    expect(l[0].raisons).toEqual([
      'Dernier intervalle vêlage-vêlage de 750 j',
      '2 diagnostics « vide » en 2 ans',
      '2 vêlages difficiles',
      '14 ans',
    ])
  })
})

import { describe, expect, it } from 'vitest'
import { lignesRegistre, periodes } from '../src/registre'
import type { Animal, Soin } from '../src/types'

const A = (id: string, o: Partial<Animal> = {}): Animal => ({
  id, updatedAt: 0, numero: 'FR' + id, travail: id, nom: '', sexe: 'F', naissance: '', mereId: '', pereId: '', pereTexte: '', statut: 'present', dateSortie: '', notes: '', ...o,
})
const S = (id: string, date: string, o: Partial<Soin> = {}): Soin => ({
  id, updatedAt: 0, animalIds: ['1'], date, type: 'antibiotique', produit: 'X', dose: '10 ml', delaiJours: 28, rappelDate: '', rappelFait: false, notes: '', ...o,
})

describe('registre des traitements', () => {
  const animals = [A('1', { nom: 'Rosa' }), A('2', { statut: 'vendu' })]
  const soins = [S('b', '2026-03-01', { animalIds: ['1', '2'], veterinaire: 'Dr Martin', ordonnance: 'ORD-12' }), S('a', '2026-01-15'), S('c', '2025-12-31'), S('d', '2026-02-01', { animalIds: ['zz'] })]

  it('garde la période, trie par date et inclut les animaux sortis', () => {
    const l = lignesRegistre({ soins, animals }, '2026-01-01', '2026-12-31')
    expect(l.map((x) => x.id)).toEqual(['a', 'd', 'b'])
    expect(l[2].animaux.map((x) => x.numero)).toEqual(['FR1', 'FR2'])
    expect(l[2]).toMatchObject({ veterinaire: 'Dr Martin', ordonnance: 'ORD-12', finAttente: '2026-03-29' })
  })
  it('reste lisible pour les anciens soins et les animaux supprimés', () => {
    const l = lignesRegistre({ soins, animals }, '2026-01-01', '2026-12-31')
    expect(l[0]).toMatchObject({ veterinaire: '', ordonnance: '' })
    expect(l[1].animaux[0].numero).toBe('(animal supprimé)')
  })
  it('propose des périodes', () => {
    const p = periodes('2026-11-07')
    expect(p[0]).toEqual({ label: 'Année 2026', du: '2026-01-01', au: '2026-11-07' })
    expect(p[2]).toEqual({ label: 'Année 2025', du: '2025-01-01', au: '2025-12-31' })
    expect(p[1].du).toBe('2025-11-07')
  })
})

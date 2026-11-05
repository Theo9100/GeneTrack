import { describe, expect, it } from 'vitest'
import { addDays, ageMonths, agenda, buildIcs, calvedSet, categorie, commonAncestors, diffDays, toCSV, withdrawalEnd } from '../src/logic'
import type { Animal, Repro, Soin } from '../src/types'

const A = (id: string, o: Partial<Animal> = {}): Animal => ({
  id, updatedAt: 0, numero: 'FR00000' + id, travail: '', nom: '', sexe: 'F', naissance: '', mereId: '', pereId: '', pereTexte: '', statut: 'present', dateSortie: '', notes: '', ...o,
})
const R = (o: Partial<Repro>): Repro => ({
  id: 'r1', updatedAt: 0, vacheId: 'v', type: 'saillie', date: '2026-01-01', taureauId: '', taureauTexte: '', diagDate: '', diagResultat: '', velageId: '', notes: '', ...o,
})

describe('dates', () => {
  it('ajoute des jours à travers un changement d heure', () => {
    expect(addDays('2026-03-20', 10)).toBe('2026-03-30')
    expect(addDays('2026-10-20', 10)).toBe('2026-10-30')
    expect(diffDays('2026-01-01', '2026-12-31')).toBe(364)
  })
  it('calcule l âge en mois', () => {
    expect(ageMonths('2025-11-06', '2026-11-05')).toBe(11)
    expect(ageMonths('2025-11-05', '2026-11-05')).toBe(12)
  })
})

describe('catégories', () => {
  it('distingue veau, génisse, vache, taureau', () => {
    const t = '2026-11-05'
    const none = new Set<string>()
    expect(categorie(A('1', { naissance: '2026-03-01' }), t, none)).toBe('veau')
    expect(categorie(A('2', { naissance: '2025-01-01' }), t, none)).toBe('genisse')
    expect(categorie(A('3', { naissance: '2020-01-01' }), t, none)).toBe('vache')
    expect(categorie(A('4', { naissance: '2024-01-01' }), t, new Set(['4']))).toBe('vache')
    expect(categorie(A('5', { sexe: 'M', naissance: '2023-01-01' }), t, none)).toBe('taureau')
  })
  it('une mère de descendant est une vache', () => {
    const mere = A('m', { naissance: '2024-01-01' })
    const veau = A('v', { mereId: 'm' })
    expect(calvedSet([mere, veau], []).has('m')).toBe(true)
  })
})

describe('consanguinité', () => {
  it('détecte un ancêtre commun et un père accouplé à sa fille', () => {
    const animals = [
      A('gp', { sexe: 'M' }),
      A('t', { sexe: 'M', pereId: 'gp' }),
      A('m', { pereId: 'gp' }),
      A('x'),
      A('fille', { pereId: 't' }),
    ]
    expect(commonAncestors(animals, 't', 'm')).toEqual(['gp'])
    expect(commonAncestors(animals, 't', 'fille').sort()).toEqual(['gp', 't'])
    expect(commonAncestors(animals, 't', 'x')).toEqual([])
  })
})

describe('alertes', () => {
  const today = '2026-10-01'
  const base = { animals: [A('v', { nom: 'Rosa', travail: '12' })], soins: [] as Soin[], gest: 285 }
  it('annonce un vêlage à venir à saillie + 285 j', () => {
    const al = agenda({ ...base, repros: [R({ date: '2026-01-01', diagResultat: 'pleine' })] }, today)
    expect(al).toHaveLength(1)
    expect(al[0].kind).toBe('velage')
    expect(al[0].date).toBe(addDays('2026-01-01', 285))
  })
  it('ignore les vaches vides ou déjà vêlées', () => {
    expect(agenda({ ...base, repros: [R({ diagResultat: 'vide' })] }, today).filter((a) => a.kind === 'velage')).toHaveLength(0)
    expect(agenda({ ...base, repros: [R({ velageId: 'x' })] }, today)).toHaveLength(0)
  })
  it('propose le diagnostic à 60 jours', () => {
    const al = agenda({ ...base, repros: [R({ date: '2026-08-10' })] }, today)
    expect(al.find((a) => a.kind === 'diag')?.date).toBe('2026-10-09')
  })
  it('signale rappels et délais d attente', () => {
    const soin: Soin = { id: 's', updatedAt: 0, animalIds: ['v'], date: '2026-09-25', type: 'antibiotique', produit: 'X', dose: '', delaiJours: 14, rappelDate: '2026-10-05', rappelFait: false, notes: '' }
    const al = agenda({ ...base, repros: [], soins: [soin] }, today)
    expect(al.map((a) => a.kind).sort()).toEqual(['attente', 'rappel'])
    expect(withdrawalEnd('2026-09-25', 14)).toBe('2026-10-09')
  })
})

describe('exports', () => {
  it('génère un ICS valide', () => {
    const ics = buildIcs([{ uid: 'a', kind: 'velage', date: '2026-10-09', titre: 'Vêlage, Rosa', detail: 'x;y', animalIds: [], lien: '', retard: false }], new Date('2026-01-01T00:00:00Z'))
    expect(ics).toContain('DTSTART;VALUE=DATE:20261009')
    expect(ics).toContain('DTEND;VALUE=DATE:20261010')
    expect(ics).toContain('SUMMARY:Vêlage\\, Rosa')
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
  })
  it('échappe le CSV', () => {
    expect(toCSV([{ a: 'x;y', b: 'say "hi"' }], ['a', 'b'])).toBe('﻿a;b\r\n"x;y";"say ""hi"""')
  })
})

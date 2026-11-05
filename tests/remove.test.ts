import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { GeneDB, loadAll, save, useTestDb } from '../src/db'
import { applyPlan, linkedCount, planAnimal, planMouvement, planSoinPourAnimal, planTout, planVelage } from '../src/remove'
import { createSync, type Remote, type Row } from '../src/sync'
import type { Animal, Mouvement, Repro, Soin, Velage } from '../src/types'

let n = 0
let db: GeneDB
beforeEach(() => {
  db = useTestDb('rm' + n++)
})
const A = (o: Partial<Animal>) => save<Animal>('animals', { numero: '', travail: '', nom: '', sexe: 'F', naissance: '', mereId: '', pereId: '', pereTexte: '', statut: 'present', dateSortie: '', notes: '', ...o } as Animal)

async function troupeau() {
  const mere = await A({ travail: '1', nom: 'Rosa' })
  const taureau = await A({ travail: '9', nom: 'Titan', sexe: 'M' })
  const veau = await A({ travail: '2', mereId: mere.id, pereId: taureau.id, statut: 'vendu' })
  const r = await save<Repro>('repros', { vacheId: mere.id, type: 'saillie', date: '2026-01-01', taureauId: taureau.id, taureauTexte: '', diagDate: '', diagResultat: 'pleine', velageId: '', notes: '' } as Repro)
  const v = await save<Velage>('velages', { mereId: mere.id, date: '2026-10-12', veauId: veau.id, sexe: 'F', facilite: 1, vigueur: 3, incidents: '', poids: null, morNe: false, reproId: r.id, notes: '' } as Velage)
  await save<Repro>('repros', { ...r, velageId: v.id })
  const s = await save<Soin>('soins', { animalIds: [mere.id, veau.id], date: '2026-10-20', type: 'vaccin', produit: 'X', dose: '', delaiJours: 0, rappelDate: '', rappelFait: false, notes: '' } as Soin)
  const m = await save<Mouvement>('mouvements', { animalId: veau.id, type: 'vente', date: '2026-11-01', acheteur: 'Négoce', poids: null, prix: 900, notes: '' } as Mouvement)
  return { mere, taureau, veau, r, v, s, m }
}

describe('suppressions', () => {
  it('supprime un animal avec ses saisies et garde ses descendants', async () => {
    const t = await troupeau()
    const p = planAnimal(await loadAll(), t.mere)
    expect(linkedCount(p)).toBe(2) // saillie + vêlage
    const undo = await applyPlan(p)
    const d = await loadAll()
    expect(d.animals.map((a) => a.id).sort()).toEqual([t.taureau.id, t.veau.id].sort())
    expect(d.animals.find((a) => a.id === t.veau.id)!.mereId).toBe('')
    expect(d.repros).toHaveLength(0)
    expect(d.velages).toHaveLength(0)
    expect(d.soins[0].animalIds).toEqual([t.veau.id]) // retiré du soin de groupe
    await undo()
    const back = await loadAll()
    expect(back.animals).toHaveLength(3)
    expect(back.animals.find((a) => a.id === t.veau.id)!.mereId).toBe(t.mere.id)
    expect(back.soins[0].animalIds).toEqual([t.mere.id, t.veau.id])
    expect(back.repros[0].velageId).toBe(t.v.id)
  })

  it('un taureau supprimé reste nommé chez ses descendants', async () => {
    const t = await troupeau()
    await applyPlan(planAnimal(await loadAll(), t.taureau))
    const d = await loadAll()
    expect(d.animals.find((a) => a.id === t.veau.id)!.pereTexte).toBe('9 Titan')
    expect(d.repros[0].taureauTexte).toBe('9 Titan')
  })

  it('supprimer une vente remet l animal présent ; supprimer un vêlage défait le lien', async () => {
    const t = await troupeau()
    await applyPlan(planMouvement(await loadAll(), t.m))
    expect((await db.animals.get(t.veau.id))!.statut).toBe('present')
    await applyPlan(planVelage(await loadAll(), (await db.velages.get(t.v.id))!))
    expect((await db.repros.get(t.r.id))!.velageId).toBe('')
    expect(await db.animals.get(t.veau.id)).toBeDefined()
  })

  it('retire seulement l animal d un soin de groupe', async () => {
    const t = await troupeau()
    await applyPlan(planSoinPourAnimal(t.s, t.veau.id))
    expect((await db.soins.get(t.s.id))!.animalIds).toEqual([t.mere.id])
  })

  it('réinitialise le troupeau, sur tous les appareils, avec annulation', async () => {
    // serveur minimal partagé
    const docs = new Map<string, Row>()
    const subs: ((t: string, rows: Row[]) => void)[] = []
    const remote = (): Remote => ({
      listen: (t, on) => {
        const f = (tt: string, rows: Row[]) => tt === t && on(rows, false)
        subs.push(f)
        setTimeout(() => on([...docs.entries()].filter(([k]) => k.startsWith(t + '/')).map(([, r]) => r), true))
        return () => {}
      },
      write: async (t, row) => {
        docs.set(`${t}/${row.id}`, row)
        setTimeout(() => subs.forEach((f) => f(t, [row])))
      },
    })
    const tick = () => new Promise((r) => setTimeout(r, 40))
    const autre = new GeneDB('rm-autre' + n)
    createSync(db, remote())
    createSync(autre, remote())
    await tick()
    await troupeau()
    await tick()
    expect(await autre.animals.count()).toBe(3)

    const undo = await applyPlan(planTout(await loadAll()))
    await tick()
    expect(await db.animals.count()).toBe(0)
    expect(await autre.animals.count()).toBe(0)
    expect(await autre.repros.count()).toBe(0)

    await undo()
    await tick()
    expect(await autre.animals.count()).toBe(3)
    expect(await autre.mouvements.count()).toBe(1)
  })
})

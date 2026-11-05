import type { Table } from 'dexie'
import { db, TABLES, type TableName } from './db'
import { label } from './logic'
import type { Animal, Data, Mouvement, Repro, Soin, TypeMouvement, Velage } from './types'

/**
 * Suppressions avec annulation.
 *
 * Chaque suppression est décrite par un « plan » : les lignes à effacer et les lignes à modifier
 * (liens à défaire, statut à rétablir…). Le plan s'applique en une transaction et conserve les
 * versions d'origine pour pouvoir tout remettre en place (bouton « Annuler »).
 * Avec la synchronisation, suppressions et annulations se propagent aux autres appareils.
 */
type Row = { id: string; updatedAt: number }
export interface Plan {
  label: string
  deletes: { table: TableName; row: Row }[]
  updates: { table: TableName; before: Row; after: Row }[]
}

const STATUT_APRES: Partial<Record<TypeMouvement, Animal['statut']>> = { vente: 'vendu', mort: 'mort', reforme: 'reforme' }
const tbl = (t: TableName) => db[t] as unknown as Table<Row, string>
const now = () => Date.now()

export async function applyPlan(plan: Plan): Promise<() => Promise<void>> {
  await db.transaction('rw', TABLES.map(tbl), async () => {
    for (const { table, row } of plan.deletes) await tbl(table).delete(row.id)
    for (const { table, after } of plan.updates) await tbl(table).put({ ...after, updatedAt: now() })
  })
  return async () => {
    await db.transaction('rw', TABLES.map(tbl), async () => {
      for (const { table, row } of plan.deletes) await tbl(table).put({ ...row, updatedAt: now() })
      for (const { table, before } of plan.updates) await tbl(table).put({ ...before, updatedAt: now() })
    })
  }
}

const plan = (label: string): Plan => ({ label, deletes: [], updates: [] })
const upd = <T extends Row>(p: Plan, table: TableName, before: T, changes: Partial<T>) => {
  // Fusionne plusieurs modifications d'une même ligne.
  const prev = p.updates.find((u) => u.table === table && u.before.id === before.id)
  if (prev) prev.after = { ...prev.after, ...changes }
  else p.updates.push({ table, before, after: { ...before, ...changes } })
}

export function planRepro(d: Data, r: Repro): Plan {
  const p = plan(`Saillie/IA du ${r.date.split('-').reverse().join('/')} supprimée`)
  p.deletes.push({ table: 'repros', row: r })
  d.velages.filter((v) => v.reproId === r.id).forEach((v) => upd(p, 'velages', v, { reproId: '' }))
  return p
}

export function planVelage(d: Data, v: Velage): Plan {
  const p = plan('Vêlage supprimé (le veau est conservé)')
  p.deletes.push({ table: 'velages', row: v })
  d.repros.filter((r) => r.velageId === v.id).forEach((r) => upd(p, 'repros', r, { velageId: '' }))
  return p
}

export function planMouvement(d: Data, m: Mouvement): Plan {
  const p = plan('Mouvement supprimé')
  p.deletes.push({ table: 'mouvements', row: m })
  const a = d.animals.find((x) => x.id === m.animalId)
  if (a && STATUT_APRES[m.type] && a.statut === STATUT_APRES[m.type]) {
    upd(p, 'animals', a, { statut: 'present', dateSortie: '' })
    p.label = `Mouvement supprimé : ${label(a)} est de nouveau présent`
  }
  return p
}

export function planSimple(table: 'soins' | 'chaleurs', row: Row, what: string): Plan {
  const p = plan(`${what} supprimé${what.endsWith('s') ? 's' : ''}`)
  p.deletes.push({ table, row })
  return p
}

/** Supprime un animal et tout ce qui le concerne ; ses descendants sont conservés (lien parent effacé). */
export function planAnimal(d: Data, a: Animal): Plan {
  const p = plan(`${label(a)} supprimé avec ses saisies`)
  const nom = [a.travail || a.numero, a.nom].filter(Boolean).join(' ')
  p.deletes.push({ table: 'animals', row: a })
  for (const c of d.animals) {
    if (c.mereId === a.id) upd(p, 'animals', c, { mereId: '' })
    if (c.pereId === a.id) upd(p, 'animals', c, { pereId: '', pereTexte: nom })
  }
  for (const r of d.repros) {
    if (r.vacheId === a.id) p.deletes.push({ table: 'repros', row: r })
    else if (r.taureauId === a.id) upd(p, 'repros', r, { taureauId: '', taureauTexte: nom })
  }
  for (const v of d.velages) {
    if (v.mereId === a.id) p.deletes.push({ table: 'velages', row: v })
    else if (v.veauId === a.id) upd(p, 'velages', v, { veauId: '' })
  }
  for (const s of d.soins) {
    if (!s.animalIds.includes(a.id)) continue
    if (s.animalIds.length === 1) p.deletes.push({ table: 'soins', row: s })
    else upd<Soin>(p, 'soins', s, { animalIds: s.animalIds.filter((x) => x !== a.id) })
  }
  d.mouvements.filter((m) => m.animalId === a.id).forEach((m) => p.deletes.push({ table: 'mouvements', row: m }))
  d.chaleurs.filter((c) => c.vacheId === a.id).forEach((c) => p.deletes.push({ table: 'chaleurs', row: c }))
  return p
}

/** Nombre de saisies supprimées en même temps que l'animal (pour l'avertissement). */
export const linkedCount = (p: Plan) => p.deletes.length - 1

const NOMS: Record<TableName, [string, string]> = {
  animals: ['animal', 'animaux'],
  repros: ['saillie/IA', 'saillies/IA'],
  velages: ['vêlage', 'vêlages'],
  soins: ['soin', 'soins'],
  mouvements: ['mouvement', 'mouvements'],
  chaleurs: ['observation de chaleurs', 'observations de chaleurs'],
}
/** Détail lisible des saisies supprimées avec l'animal, ex. « 1 saillie/IA, 2 soins ». */
export function linkedSummary(p: Plan): string {
  const counts = new Map<TableName, number>()
  p.deletes.slice(1).forEach((d) => counts.set(d.table, (counts.get(d.table) ?? 0) + 1))
  return [...counts].map(([t, n]) => `${n} ${NOMS[t][n > 1 ? 1 : 0]}`).join(', ')
}

/** Réinitialisation complète du troupeau (les réglages et le mot de passe sont conservés). */
export function planTout(d: Data): Plan {
  const p = plan('Troupeau réinitialisé')
  for (const t of TABLES) for (const row of (d as unknown as Record<TableName, Row[]>)[t]) p.deletes.push({ table: t, row })
  return p
}

/** Depuis la fiche d'un animal : un soin de groupe perd seulement cet animal, un soin individuel est supprimé. */
export function planSoinPourAnimal(s: Soin, animalId: string): Plan {
  if (s.animalIds.length <= 1) return planSimple('soins', s, 'Soin')
  const p = plan(`Animal retiré du soin (${s.animalIds.length - 1} autre${s.animalIds.length > 2 ? 's' : ''} conservé${s.animalIds.length > 2 ? 's' : ''})`)
  upd<Soin>(p, 'soins', s, { animalIds: s.animalIds.filter((x) => x !== animalId) })
  return p
}

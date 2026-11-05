import Dexie, { type Table } from 'dexie'
import type { Animal, Data, Mouvement, Repro, Soin, Velage } from './types'

export interface Setting {
  key: string
  value: unknown
}

export class GeneDB extends Dexie {
  animals!: Table<Animal, string>
  repros!: Table<Repro, string>
  velages!: Table<Velage, string>
  soins!: Table<Soin, string>
  mouvements!: Table<Mouvement, string>
  settings!: Table<Setting, string>

  constructor(name = 'genetrack') {
    super(name)
    this.version(1).stores({
      animals: 'id, numero, statut, mereId, pereId',
      repros: 'id, vacheId, date',
      velages: 'id, mereId, date',
      soins: 'id, date, rappelDate',
      mouvements: 'id, animalId, date',
      settings: 'key',
    })
  }
}

export let db = new GeneDB()
/** Pour les tests : base isolée. */
export function useTestDb(name: string) {
  db = new GeneDB(name)
  return db
}

export const GESTATION_DEFAUT = 285

export function newId(): string {
  const c = globalThis.crypto as Crypto | undefined
  if (c?.randomUUID) return c.randomUUID()
  return 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
}

export const TABLES = ['animals', 'repros', 'velages', 'soins', 'mouvements'] as const
export type TableName = (typeof TABLES)[number]

export async function getSetting<T>(key: string, def: T): Promise<T> {
  const s = await db.settings.get(key)
  return s ? (s.value as T) : def
}
export async function setSetting(key: string, value: unknown) {
  await db.settings.put({ key, value })
}

/** Enregistre (création ou modification) en horodatant pour la fusion des sauvegardes. */
export async function save<T extends { id: string; updatedAt: number }>(table: TableName, row: Omit<T, 'id' | 'updatedAt'> & { id?: string }): Promise<T> {
  const full = { ...row, id: row.id || newId(), updatedAt: Date.now() } as T
  await (db[table] as unknown as Table<T, string>).put(full)
  return full
}

export async function loadAll(): Promise<Data> {
  const [animals, repros, velages, soins, mouvements, gest] = await Promise.all([
    db.animals.toArray(),
    db.repros.toArray(),
    db.velages.toArray(),
    db.soins.toArray(),
    db.mouvements.toArray(),
    getSetting<number>('gestationJours', GESTATION_DEFAUT),
  ])
  return { animals, repros, velages, soins, mouvements, gest }
}

export const blankAnimal = (): Omit<Animal, 'id' | 'updatedAt'> => ({
  numero: '',
  travail: '',
  nom: '',
  sexe: 'F',
  naissance: '',
  mereId: '',
  pereId: '',
  pereTexte: '',
  statut: 'present',
  dateSortie: '',
  notes: '',
})

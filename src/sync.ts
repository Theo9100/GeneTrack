import type { Table } from 'dexie'
import { TABLES, type GeneDB, type TableName } from './db'

/**
 * Synchronisation multi-appareils.
 *
 * La base locale (IndexedDB) reste la source de vérité de chaque appareil : l'app fonctionne hors ligne.
 * Chaque écriture locale est envoyée au serveur ; chaque changement reçu du serveur est appliqué localement
 * s'il est plus récent (champ updatedAt). Une suppression est envoyée comme « pierre tombale »
 * ({ id, updatedAt, deleted: true }) pour être propagée aux autres appareils.
 */

export type Row = { id: string; updatedAt: number; deleted?: boolean; [k: string]: unknown }

export interface Remote {
  /** Écoute une table ; `initial` vaut true pour le premier lot (contenu complet). */
  listen(table: TableName, onRows: (rows: Row[], initial: boolean) => void, onError: (e: unknown) => void): () => void
  write(table: TableName, row: Row): Promise<void>
}

export interface SyncStatus {
  state: 'off' | 'connecting' | 'synced' | 'pending' | 'error'
  error?: string
  email?: string
  lastSync?: number
}

/** Supprime les valeurs undefined (refusées par Firestore). */
const clean = (o: unknown): Row => JSON.parse(JSON.stringify(o))

export function createSync(db: GeneDB, remote: Remote, onStatus: (s: Partial<SyncStatus>) => void = () => {}) {
  const applying = new Set<string>() // écritures venant du serveur, à ne pas renvoyer
  const key = (t: string, id: string, v: number | 'del') => `${t}|${id}|${v}`
  const initialDone = new Set<string>()
  const cleanups: (() => void)[] = []
  let pending = 0
  let failed = false

  const refresh = () => {
    if (failed) return
    if (pending > 0) onStatus({ state: 'pending' })
    else if (initialDone.size === TABLES.length) onStatus({ state: 'synced', lastSync: Date.now() })
  }
  const push = (t: TableName, row: unknown) => {
    pending++
    refresh()
    remote.write(t, clean(row)).then(
      () => {
        pending--
        refresh()
      },
      (e) => {
        pending--
        failed = true
        onStatus({ state: 'error', error: e instanceof Error ? e.message : String(e) })
      },
    )
  }

  for (const t of TABLES) {
    const table = db[t] as unknown as Table<Row, string>
    const creating = function (this: { onsuccess?: () => void }, _pk: unknown, obj: Row) {
      if (applying.delete(key(t, obj.id, obj.updatedAt))) return
      this.onsuccess = () => push(t, obj)
    }
    const updating = function (this: { onsuccess?: (o: Row) => void }, mods: Partial<Row>, pk: string, obj: Row) {
      const next = { ...obj, ...mods } as Row
      if (applying.delete(key(t, pk, next.updatedAt))) return
      this.onsuccess = (updated) => push(t, updated ?? next)
    }
    const deleting = function (this: { onsuccess?: () => void }, pk: string) {
      if (applying.delete(key(t, pk, 'del'))) return
      this.onsuccess = () => push(t, { id: pk, updatedAt: Date.now(), deleted: true })
    }
    table.hook('creating', creating as never)
    table.hook('updating', updating as never)
    table.hook('deleting', deleting as never)
    cleanups.push(() => {
      table.hook('creating').unsubscribe(creating as never)
      table.hook('updating').unsubscribe(updating as never)
      table.hook('deleting').unsubscribe(deleting as never)
    })

    // Les lots reçus sont traités l'un après l'autre.
    let queue = Promise.resolve()
    const apply = async (rows: Row[], initial: boolean) => {
      const seen = new Map<string, Row>()
      for (const row of rows) {
        if (!row || typeof row.id !== 'string') continue
        seen.set(row.id, row)
        const local = await table.get(row.id)
        if (row.deleted) {
          if (local && (local.updatedAt ?? 0) <= row.updatedAt) {
            applying.add(key(t, row.id, 'del'))
            await table.delete(row.id)
          }
        } else if (!local || row.updatedAt > (local.updatedAt ?? 0)) {
          const { deleted: _d, ...data } = row
          applying.add(key(t, row.id, row.updatedAt))
          await table.put(data as Row)
        }
      }
      if (initial) {
        // Ce qui a été saisi localement (hors ligne, ou avant d'activer la synchro) part vers le serveur.
        for (const l of await table.toArray()) {
          const r = seen.get(l.id)
          if (!r || (l.updatedAt ?? 0) > r.updatedAt) push(t, l)
        }
        initialDone.add(t)
      }
      refresh()
    }
    cleanups.push(
      remote.listen(
        t,
        (rows, initial) => {
          queue = queue.then(() => apply(rows, initial)).catch((e) => onStatus({ state: 'error', error: String(e) }))
        },
        (e) => {
          failed = true
          onStatus({ state: 'error', error: e instanceof Error ? e.message : String(e) })
        },
      ),
    )
  }
  onStatus({ state: 'connecting' })
  return () => cleanups.forEach((f) => f())
}

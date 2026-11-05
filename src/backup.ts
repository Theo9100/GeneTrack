import { db, getSetting, setSetting, TABLES, GESTATION_DEFAUT } from './db'
import type { Table } from 'dexie'

export interface BackupFile {
  app: 'genetrack'
  version: 1
  exportedAt: string
  gestationJours: number
  animals: unknown[]
  repros: unknown[]
  velages: unknown[]
  soins: unknown[]
  mouvements: unknown[]
  chaleurs: unknown[]
}

export async function exportData(): Promise<BackupFile> {
  const [animals, repros, velages, soins, mouvements, chaleurs, gestationJours] = await Promise.all([
    db.animals.toArray(),
    db.repros.toArray(),
    db.velages.toArray(),
    db.soins.toArray(),
    db.mouvements.toArray(),
    db.chaleurs.toArray(),
    getSetting<number>('gestationJours', GESTATION_DEFAUT),
  ])
  await setSetting('lastBackup', Date.now())
  return { app: 'genetrack', version: 1, exportedAt: new Date().toISOString(), gestationJours, animals, repros, velages, soins, mouvements, chaleurs }
}

export function parseBackup(text: string): BackupFile {
  let obj: any
  try {
    obj = JSON.parse(text)
  } catch {
    throw new Error("Le fichier n'est pas un JSON valide.")
  }
  if (!obj || obj.app !== 'genetrack' || obj.version !== 1) throw new Error("Ce fichier n'est pas une sauvegarde GeneTrack.")
  // les sauvegardes antérieures à l'ajout des chaleurs restent valides
  if (obj.chaleurs === undefined) obj.chaleurs = []
  for (const t of TABLES) {
    if (!Array.isArray(obj[t])) throw new Error(`Sauvegarde incomplète : « ${t} » manquant.`)
    for (const r of obj[t]) if (!r || typeof r.id !== 'string') throw new Error(`Sauvegarde corrompue : enregistrement sans identifiant dans « ${t} ».`)
  }
  return obj as BackupFile
}

export interface ImportReport {
  ajoutes: number
  misAJour: number
  ignores: number
}

/**
 * replace : efface tout puis restaure.
 * merge : ajoute les nouveaux enregistrements, et remplace ceux dont la copie importée est plus récente.
 * Les suppressions ne sont pas propagées en mode fusion.
 */
export async function importData(file: BackupFile, mode: 'replace' | 'merge'): Promise<ImportReport> {
  const report: ImportReport = { ajoutes: 0, misAJour: 0, ignores: 0 }
  const tables = TABLES.map((t) => db[t] as unknown as Table<{ id: string; updatedAt: number }, string>)
  await db.transaction('rw', [...tables, db.settings], async () => {
    for (const [i, name] of TABLES.entries()) {
      const table = tables[i]
      const rows = file[name] as { id: string; updatedAt: number }[]
      if (mode === 'replace') {
        // suppression clé par clé (et non clear()) pour que la synchronisation voie les suppressions
        await table.bulkDelete((await table.toCollection().primaryKeys()) as string[])
        await table.bulkPut(rows)
        report.ajoutes += rows.length
        continue
      }
      for (const row of rows) {
        const cur = await table.get(row.id)
        if (!cur) {
          await table.put(row)
          report.ajoutes++
        } else if ((row.updatedAt ?? 0) > (cur.updatedAt ?? 0)) {
          await table.put(row)
          report.misAJour++
        } else report.ignores++
      }
    }
    if (mode === 'replace' && typeof file.gestationJours === 'number') await setSetting('gestationJours', file.gestationJours)
  })
  return report
}

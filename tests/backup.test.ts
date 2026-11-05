import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, save, useTestDb, loadAll } from '../src/db'
import { exportData, importData, parseBackup } from '../src/backup'
import { hasPassword, setPassword, verifyPassword } from '../src/auth'
import type { Animal } from '../src/types'

let n = 0
beforeEach(async () => {
  useTestDb('t' + n++)
})

const mk = (numero: string) => ({ numero, travail: '', nom: '', sexe: 'F' as const, naissance: '', mereId: '', pereId: '', pereTexte: '', statut: 'present' as const, dateSortie: '', notes: '' })

describe('sauvegarde', () => {
  it('exporte puis restaure à l identique', async () => {
    const a = await save<Animal>('animals', mk('FR1'))
    const file = parseBackup(JSON.stringify(await exportData()))
    await db.animals.clear()
    const rep = await importData(file, 'replace')
    expect(rep.ajoutes).toBe(1)
    expect((await loadAll()).animals[0].id).toBe(a.id)
  })
  it('fusionne en gardant la version la plus récente', async () => {
    const a = await save<Animal>('animals', mk('FR1'))
    const file = parseBackup(JSON.stringify(await exportData()))
    file.animals = [
      { ...a, nom: 'Plus récent', updatedAt: a.updatedAt + 1000 },
      { ...a, id: 'autre', numero: 'FR2' },
    ]
    const rep = await importData(file, 'merge')
    expect(rep).toEqual({ ajoutes: 1, misAJour: 1, ignores: 0 })
    expect((await db.animals.get(a.id))!.nom).toBe('Plus récent')
  })
  it('rejette un fichier invalide', () => {
    expect(() => parseBackup('pas du json')).toThrow()
    expect(() => parseBackup('{"app":"autre"}')).toThrow()
    expect(() => parseBackup(JSON.stringify({ app: 'genetrack', version: 1, animals: [] }))).toThrow(/incomplète/)
  })
})

describe('mot de passe', () => {
  it('vérifie le mot de passe', async () => {
    expect(await hasPassword()).toBe(false)
    await setPassword('secret1')
    expect(await hasPassword()).toBe(true)
    expect(await verifyPassword('secret1')).toBe(true)
    expect(await verifyPassword('autre')).toBe(false)
  })
})

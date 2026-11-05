import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { GeneDB, newId, type TableName } from '../src/db'
import { createSync, type Remote, type Row } from '../src/sync'
import { parseFirebaseConfig } from '../src/config'

/** Faux serveur : stocke les documents et diffuse chaque écriture aux appareils à l'écoute. */
class FakeServer {
  data = new Map<string, Map<string, Row>>()
  listeners = new Map<string, Set<(rows: Row[], initial: boolean) => void>>()
  online = true
  queue: [TableName, Row][] = []
  remote(): Remote {
    return {
      listen: (t, on) => {
        if (!this.listeners.has(t)) this.listeners.set(t, new Set())
        this.listeners.get(t)!.add(on)
        setTimeout(() => on([...(this.data.get(t)?.values() ?? [])], true))
        return () => this.listeners.get(t)!.delete(on)
      },
      write: async (t, row) => {
        if (!this.online) return void this.queue.push([t, row])
        this.store(t, row)
      },
    }
  }
  store(t: TableName, row: Row) {
    if (!this.data.has(t)) this.data.set(t, new Map())
    this.data.get(t)!.set(row.id, row)
    setTimeout(() => this.listeners.get(t)?.forEach((f) => f([row], false)))
  }
  reconnect() {
    this.online = true
    this.queue.splice(0).forEach(([t, r]) => this.store(t, r))
  }
}

const tick = (ms = 30) => new Promise((r) => setTimeout(r, ms))
let n = 0
const device = () => new GeneDB('dev' + n++)
const animal = (numero: string, extra = {}) => ({ id: newId(), updatedAt: Date.now(), numero, travail: '', nom: '', sexe: 'F', naissance: '', mereId: '', pereId: '', pereTexte: '', statut: 'present', dateSortie: '', notes: '', ...extra })

describe('synchronisation', () => {
  it('propage créations, modifications et suppressions entre deux appareils', async () => {
    const srv = new FakeServer()
    const a = device(), b = device()
    createSync(a, srv.remote()); createSync(b, srv.remote())
    await tick()
    const x = animal('FR1')
    await a.animals.put(x as never)
    await tick()
    expect((await b.animals.get(x.id))?.numero).toBe('FR1')

    await b.animals.put({ ...x, nom: 'Rosa', updatedAt: x.updatedAt + 10 } as never)
    await tick()
    expect((await a.animals.get(x.id))?.nom).toBe('Rosa')

    await a.animals.delete(x.id)
    await tick()
    expect(await b.animals.get(x.id)).toBeUndefined()
    expect(srv.data.get('animals')!.get(x.id)!.deleted).toBe(true)
  })

  it('envoie au démarrage les données saisies avant la synchronisation', async () => {
    const srv = new FakeServer()
    const a = device(), b = device()
    const x = animal('FR2')
    await a.animals.put(x as never) // saisi hors synchro
    createSync(a, srv.remote())
    await tick()
    createSync(b, srv.remote())
    await tick()
    expect((await b.animals.get(x.id))?.numero).toBe('FR2')
  })

  it('rattrape les saisies faites hors ligne et garde la version la plus récente', async () => {
    const srv = new FakeServer()
    const a = device(), b = device()
    createSync(a, srv.remote()); createSync(b, srv.remote())
    await tick()
    const x = animal('FR3')
    await a.animals.put(x as never)
    await tick()
    srv.online = false
    await a.chaleurs.put({ id: 'c1', updatedAt: Date.now(), vacheId: x.id, date: '2026-11-01', notes: '' } as never)
    await b.animals.put({ ...x, nom: 'ancien', updatedAt: x.updatedAt + 1 } as never)
    await a.animals.put({ ...x, nom: 'récent', updatedAt: x.updatedAt + 5 } as never)
    await tick()
    expect(await b.chaleurs.get('c1')).toBeUndefined()
    srv.reconnect()
    await tick()
    expect(await b.chaleurs.get('c1')).toBeDefined()
    expect((await a.animals.get(x.id))?.nom).toBe('récent')
    expect((await b.animals.get(x.id))?.nom).toBe('récent')
  })

  it('ne renvoie pas au serveur ce qui vient du serveur', async () => {
    const srv = new FakeServer()
    let writes = 0
    const r = srv.remote()
    const counted: Remote = { listen: r.listen, write: (t, row) => (writes++, r.write(t, row)) }
    const a = device(), b = device()
    createSync(a, srv.remote()); createSync(b, counted)
    await tick()
    await a.animals.put(animal('FR4') as never)
    await tick()
    expect(writes).toBe(0)
  })
})

describe('configuration Firebase', () => {
  it('accepte le JSON et l objet copié depuis la console', () => {
    const js = `const firebaseConfig = {\n  apiKey: "AIza-x",\n  authDomain: "p.firebaseapp.com",\n  projectId: "p",\n  appId: "1:2:web:3"\n};`
    expect(parseFirebaseConfig(js)?.projectId).toBe('p')
    expect(parseFirebaseConfig('{"apiKey":"a","projectId":"p","appId":"x"}')?.apiKey).toBe('a')
    expect(parseFirebaseConfig('')).toBeNull()
    expect(parseFirebaseConfig('{"apiKey":"a"}')).toBeNull()
  })
})

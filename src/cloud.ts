import { useEffect, useState } from 'preact/hooks'
import { cloudEnabled } from './config'
import { db } from './db'
import { createSync, type SyncStatus } from './sync'

let status: SyncStatus = { state: cloudEnabled ? 'connecting' : 'off' }
const listeners = new Set<(s: SyncStatus) => void>()
const setStatus = (s: Partial<SyncStatus>) => {
  status = { ...status, ...s }
  listeners.forEach((f) => f(status))
}

export function useSyncStatus(): SyncStatus {
  const [s, set] = useState(status)
  useEffect(() => {
    listeners.add(set)
    set(status)
    return () => void listeners.delete(set)
  }, [])
  return s
}

const fb = () => import('./firebase')
let stop: (() => void) | null = null

/** Démarre la synchronisation si un compte est connecté sur cet appareil. */
export async function startCloud() {
  if (!cloudEnabled || stop) return
  try {
    const m = await fb()
    const user = await m.currentUser()
    if (!user) return setStatus({ state: 'error', error: 'Non connecté.' })
    setStatus({ email: user.email ?? '' })
    stop = createSync(db, m.remoteFor(user.uid), setStatus)
  } catch (e) {
    setStatus({ state: 'error', error: e instanceof Error ? e.message : String(e) })
  }
}

export async function cloudUser() {
  return cloudEnabled ? (await fb()).currentUser() : null
}
export async function cloudLogin(email: string, password: string, create: boolean) {
  return (await fb()).login(email, password, create)
}
export async function cloudReset(email: string) {
  return (await fb()).resetPassword(email)
}
export async function cloudLogout() {
  stop?.()
  stop = null
  await (await fb()).logout()
  setStatus({ state: 'error', error: 'Déconnecté.', email: '' })
}

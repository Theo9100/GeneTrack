import { Cloud, CloudOff, RefreshCw } from 'lucide-preact'
import { cloudEnabled } from './config'
import { useSyncStatus } from './cloud'

export const SYNC_LABEL = {
  off: 'Non configurée',
  connecting: 'Connexion…',
  synced: 'Synchronisé',
  pending: 'Envoi en attente de réseau',
  error: 'Erreur de synchronisation',
} as const

/** Pastille d'état de la synchronisation (rien si elle n'est pas configurée). */
export function SyncBadge() {
  const s = useSyncStatus()
  if (!cloudEnabled) return null
  const Icon = s.state === 'synced' ? Cloud : s.state === 'error' ? CloudOff : RefreshCw
  return (
    <a class={'btn icon-btn sync ' + s.state} href="#/reglages" title={SYNC_LABEL[s.state] + (s.error ? ` : ${s.error}` : '')} aria-label={SYNC_LABEL[s.state]}>
      <Icon size={18} />
    </a>
  )
}

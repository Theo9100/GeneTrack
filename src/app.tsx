import { useEffect, useState } from 'preact/hooks'
import { Lock } from './lock'
import { useData, useRoute } from './ui'
import { Accueil } from './views/accueil'
import { FicheAnimal, FormAnimal, ListeAnimaux } from './views/animaux'
import { FormRepro, FormVelage, ListeRepro, ListeVelages } from './views/reproduction'
import { FormSoin, ListeSoins } from './views/sante'
import { FormMouvement, ListeMouvements } from './views/mouvements'
import { Reglages } from './views/reglages'

const TABS = [
  { to: '/', icon: '🏠', text: 'Accueil', key: '' },
  { to: '/animaux', icon: '🐂', text: 'Animaux', key: 'animaux' },
  { to: '/repro', icon: '🍼', text: 'Repro', key: 'repro' },
  { to: '/sante', icon: '💉', text: 'Santé', key: 'sante' },
  { to: '/mouvements', icon: '🚚', text: 'Ventes', key: 'mouvements' },
]

export function App() {
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem('gt-unlocked') === '1')
  const unlock = () => {
    sessionStorage.setItem('gt-unlocked', '1')
    setUnlocked(true)
    navigator.storage?.persist?.().catch(() => {})
  }
  const lock = () => {
    sessionStorage.removeItem('gt-unlocked')
    setUnlocked(false)
  }
  useEffect(() => {
    if (unlocked) navigator.storage?.persist?.().catch(() => {})
  }, [unlocked])
  if (!unlocked) return <Lock onUnlock={unlock} />
  return <Shell onLock={lock} />
}

function Shell({ onLock }: { onLock: () => void }) {
  const data = useData()
  const { parts, q } = useRoute()
  if (!data) return <main><p class="empty">Chargement…</p></main>
  const [section, a, b] = parts
  let view
  switch (section) {
    case undefined:
      view = <Accueil data={data} />
      break
    case 'animaux':
      view = !a ? <ListeAnimaux data={data} /> : a === 'new' ? <FormAnimal data={data} mere={q.get('mere') ?? undefined} /> : b === 'edit' ? <FormAnimal data={data} id={a} /> : <FicheAnimal data={data} id={a} />
      break
    case 'repro':
      view = !a ? <ListeRepro data={data} /> : a === 'new' ? <FormRepro data={data} vache={q.get('vache') ?? undefined} /> : <FormRepro data={data} id={a} />
      break
    case 'velages':
      view = !a ? <ListeVelages data={data} /> : a === 'new' ? <FormVelage data={data} mere={q.get('mere') ?? undefined} /> : <FormVelage data={data} id={a} />
      break
    case 'sante':
      view = !a ? <ListeSoins data={data} /> : a === 'new' ? <FormSoin data={data} animal={q.get('animal') ?? undefined} /> : <FormSoin data={data} id={a} />
      break
    case 'mouvements':
      view = !a ? <ListeMouvements data={data} /> : a === 'new' ? <FormMouvement data={data} animal={q.get('animal') ?? undefined} /> : <FormMouvement data={data} id={a} />
      break
    case 'reglages':
      view = <Reglages data={data} onLock={onLock} />
      break
    default:
      view = <main><p class="empty">Page introuvable. <a href="#/">Accueil</a></p></main>
  }
  const active = section === 'velages' ? 'repro' : (section ?? '')
  return (
    <>
      {/* key = route complète : réinitialise l'état des formulaires à chaque changement de page */}
      <div key={parts.join('/') + '?' + q.toString()}>{view}</div>
      <nav class="tabs">
        {TABS.map((t) => (
          <a key={t.key} href={'#' + t.to} class={active === t.key ? 'on' : ''}>
            <span>{t.icon}</span>
            {t.text}
          </a>
        ))}
      </nav>
    </>
  )
}

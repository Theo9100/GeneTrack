import { useEffect, useState } from 'preact/hooks'
import { CalendarHeart, House, Settings, Syringe, Truck } from 'lucide-preact'
import { Lock } from './lock'
import { startCloud } from './cloud'
import { Toaster, useData, useRoute } from './ui'
import { Accueil } from './views/accueil'
import { FicheAnimal, FormAnimal, ListeAnimaux } from './views/animaux'
import { FormChaleur, FormRepro, FormVelage, ListeRepro, ListeVelages } from './views/reproduction'
import { FormSoin, ListeSoins } from './views/sante'
import { FormMouvement, ListeMouvements } from './views/mouvements'
import { Reglages } from './views/reglages'

/** Tête de bovin, dans le style des icônes Lucide. */
const Cow = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M7 8.5C5 8.3 3.3 7 3 5c2 0 3.6.7 4.4 2M17 8.5c2-.2 3.7-1.5 4-3.5-2 0-3.6.7-4.4 2" />
    <path d="M7.5 7.5C8 6 10 5.5 12 5.5s4 .5 4.5 2v6c0 3-2 5.5-4.5 5.5s-4.5-2.5-4.5-5.5z" />
    <path d="M10 16h4" />
    <circle cx="10" cy="11" r=".6" fill="currentColor" />
    <circle cx="14" cy="11" r=".6" fill="currentColor" />
  </svg>
)

const TABS = [
  { to: '/', Icon: House, text: 'Accueil', key: '' },
  { to: '/animaux', Icon: Cow, text: 'Animaux', key: 'animaux' },
  { to: '/repro', Icon: CalendarHeart, text: 'Repro', key: 'repro' },
  { to: '/sante', Icon: Syringe, text: 'Santé', key: 'sante' },
  { to: '/mouvements', Icon: Truck, text: 'Ventes', key: 'mouvements' },
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
    if (!unlocked) return
    navigator.storage?.persist?.().catch(() => {})
    startCloud()
  }, [unlocked])
  if (!unlocked) return <Lock onUnlock={unlock} />
  return <Shell onLock={lock} />
}

function Shell({ onLock }: { onLock: () => void }) {
  const data = useData()
  const { parts, q } = useRoute()
  const routeKey = parts.join('/') + '?' + q.toString()
  useEffect(() => window.scrollTo(0, 0), [routeKey])
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
    case 'chaleurs':
      view = a === 'new' || !a ? <FormChaleur data={data} vache={q.get('vache') ?? undefined} /> : <FormChaleur data={data} id={a} />
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
  const active = section === 'velages' || section === 'chaleurs' ? 'repro' : (section ?? '')
  return (
    <>
      {/* key = route complète : réinitialise l'état des formulaires à chaque changement de page */}
      <div key={routeKey}>{view}</div>
      <nav class="tabs">
        <a class="brand" href="#/">
          <img src="icon-192.png" alt="" />
          <span><b>GeneTrack</b><small>Blonde d'Aquitaine</small></span>
        </a>
        {TABS.map(({ to, Icon, text, key }) => (
          <a key={key} href={'#' + to} class={active === key ? 'on' : ''}>
            <Icon size={22} />
            {text}
          </a>
        ))}
        <span class="spacer" />
        <a class={'side-only' + (active === 'reglages' ? ' on' : '')} href="#/reglages">
          <Settings size={22} />
          Réglages
        </a>
      </nav>
      <Toaster />
    </>
  )
}

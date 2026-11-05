import { useEffect, useState } from 'preact/hooks'
import { Baby, CalendarHeart, ChevronRight, Plus, Save, Settings, Syringe, Truck } from 'lucide-preact'
import { getSetting } from '../db'
import type { Data } from '../types'
import { Badge, Card, DateChip, Empty, Page } from '../ui'
import { agenda, calvedSet, categorie, diffDays, isoToday, type AlerteKind, type Categorie } from '../logic'

const SECTIONS: { kind: AlerteKind; titre: string; vide: string }[] = [
  { kind: 'velage', titre: 'Vêlages à venir', vide: 'Aucun vêlage prévu dans les 90 jours.' },
  { kind: 'diag', titre: 'Diagnostics de gestation', vide: 'Aucun diagnostic à faire prochainement.' },
  { kind: 'rappel', titre: 'Rappels de santé', vide: 'Aucun rappel dans les 30 jours.' },
  { kind: 'attente', titre: "Délais d'attente en cours", vide: "Aucun délai d'attente en cours." },
]
const STAT_LABEL: Record<Categorie, [string, string]> = {
  vache: ['Vache', 'Vaches'],
  genisse: ['Génisse', 'Génisses'],
  veau: ['Veau', 'Veaux'],
  taureau: ['Taureau', 'Taureaux'],
}

export function Accueil({ data }: { data: Data }) {
  const today = isoToday()
  const [lastBackup, setLast] = useState<number | null | undefined>(undefined)
  useEffect(() => {
    getSetting<number | null>('lastBackup', null).then(setLast)
  }, [data])
  const present = data.animals.filter((a) => a.statut === 'present')
  const calved = calvedSet(data.animals, data.velages)
  const counts: Record<Categorie, number> = { vache: 0, genisse: 0, veau: 0, taureau: 0 }
  present.forEach((a) => counts[categorie(a, today, calved)]++)
  const alertes = agenda(data, today)
  const joursBackup = lastBackup ? Math.floor((Date.now() - lastBackup) / 864e5) : null
  const besoinBackup = data.animals.length > 0 && lastBackup !== undefined && (joursBackup === null || joursBackup >= 14)
  const d = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  const jour = d.charAt(0).toUpperCase() + d.slice(1)

  return (
    <Page
      title="Troupeau"
      sub={`${jour} · ${present.length} ${present.length > 1 ? 'animaux présents' : 'animal présent'}`}
      actions={<a class="btn icon-btn" href="#/reglages" aria-label="Réglages" title="Réglages"><Settings size={18} /></a>}
    >
      {besoinBackup && (
        <a class="banner" href="#/reglages">
          <Save size={18} />
          <span>{joursBackup === null ? "Aucune sauvegarde n'a encore été faite." : `Dernière sauvegarde il y a ${joursBackup} jours.`} Exportez vos données.</span>
        </a>
      )}
      <Card>
        <div class="stats">
          {(Object.keys(counts) as Categorie[]).map((c) => (
            <div key={c}>
              <b>{counts[c]}</b>
              <span>{STAT_LABEL[c][counts[c] > 1 ? 1 : 0]}</span>
            </div>
          ))}
        </div>
      </Card>
      <div class="chips">
        <a class="btn small" href="#/animaux/new"><Plus size={16} />Animal</a>
        <a class="btn small" href="#/velages/new"><Baby size={16} />Vêlage</a>
        <a class="btn small" href="#/repro/new"><CalendarHeart size={16} />Saillie / IA</a>
        <a class="btn small" href="#/sante/new"><Syringe size={16} />Soin</a>
        <a class="btn small" href="#/mouvements/new"><Truck size={16} />Vente</a>
      </div>
      {!data.animals.length && (
        <Card title="Bienvenue">
          <p>Commencez par enregistrer vos animaux : les mères d'abord, puis leurs descendants, pour que la généalogie se construise. Tout reste sur cet appareil.</p>
          <a class="btn primary" href="#/animaux/new"><Plus size={16} />Ajouter un animal</a>
        </Card>
      )}
      {SECTIONS.map(({ kind, titre, vide }) => {
        const l = alertes.filter((a) => a.kind === kind)
        return (
          <Card key={kind} title={titre} count={l.length}>
            {l.length ? (
              <ul class="list">
                {l.map((a) => {
                  const j = diffDays(today, a.date)
                  return (
                    <li key={a.uid}>
                      <DateChip iso={a.date} tone={a.retard ? 'late' : j <= 7 ? 'soon' : ''} />
                      <a class="item" href={'#' + a.lien}>
                        <b>{a.titre.replace(/^[^:]+: /, '')}</b>
                        <small>{a.detail}</small>
                      </a>
                      <span class="trail">
                        <Badge tone={a.retard ? 'bad' : j <= 7 ? 'warn' : 'grey'}>{j === 0 ? "Aujourd'hui" : j > 0 ? `J-${j}` : `+${-j} j`}</Badge>
                        <ChevronRight size={18} class="chev" />
                      </span>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <Empty>{vide}</Empty>
            )}
          </Card>
        )
      })}
    </Page>
  )
}

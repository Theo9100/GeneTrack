import { useEffect, useState } from 'preact/hooks'
import { getSetting } from '../db'
import type { Data } from '../types'
import { Badge, Card, Empty, Page } from '../ui'
import { CATEGORIE_LABEL, agenda, calvedSet, categorie, diffDays, formatDate, isoToday, type AlerteKind, type Categorie } from '../logic'

const SECTIONS: { kind: AlerteKind; titre: string; vide: string }[] = [
  { kind: 'velage', titre: 'Vêlages à venir', vide: 'Aucun vêlage prévu dans les 90 prochains jours.' },
  { kind: 'diag', titre: 'Diagnostics de gestation', vide: 'Aucun diagnostic à faire prochainement.' },
  { kind: 'rappel', titre: 'Rappels de santé', vide: 'Aucun rappel dans les 30 jours.' },
  { kind: 'attente', titre: "Délais d'attente en cours", vide: "Aucun délai d'attente en cours." },
]

export function Accueil({ data }: { data: Data }) {
  const today = isoToday()
  const [lastBackup, setLast] = useState<number | null | undefined>(undefined)
  useEffect(() => {
    getSetting<number | null>('lastBackup', null).then(setLast)
  }, [data])
  const present = data.animals.filter((a) => a.statut === 'present')
  const calved = calvedSet(data.animals, data.velages)
  const counts: Record<Categorie, number> = { veau: 0, genisse: 0, vache: 0, taureau: 0 }
  present.forEach((a) => counts[categorie(a, today, calved)]++)
  const alertes = agenda(data, today)
  const joursBackup = lastBackup ? Math.floor((Date.now() - lastBackup) / 864e5) : null
  const besoinBackup = data.animals.length > 0 && lastBackup !== undefined && (joursBackup === null || joursBackup >= 14)

  return (
    <Page title="Troupeau" actions={<a class="btn small" href="#/reglages">⚙</a>}>
      {besoinBackup && (
        <a class="banner" style="display:block;text-decoration:none" href="#/reglages">
          💾 {joursBackup === null ? "Aucune sauvegarde n'a encore été faite." : `Dernière sauvegarde il y a ${joursBackup} jours.`} Exportez vos données.
        </a>
      )}
      <Card>
        <div class="grid">
          <div class="stat"><b>{present.length}</b><span>Présents</span></div>
          {(Object.keys(counts) as Categorie[]).map((c) => (
            <div class="stat" key={c}><b>{counts[c]}</b><span>{CATEGORIE_LABEL[c]}{counts[c] > 1 && c !== 'veau' ? 's' : ''}</span></div>
          ))}
        </div>
      </Card>
      <div class="row" style="margin-bottom:12px">
        <a class="btn small" href="#/animaux/new">+ Animal</a>
        <a class="btn small" href="#/velages/new">+ Vêlage</a>
        <a class="btn small" href="#/repro/new">+ Saillie / IA</a>
        <a class="btn small" href="#/sante/new">+ Soin</a>
        <a class="btn small" href="#/mouvements/new">+ Vente</a>
      </div>
      {!data.animals.length && (
        <Card title="Bienvenue">
          <p>Commencez par enregistrer vos animaux avec « + Animal » (mères d'abord, puis leurs descendants). Tout reste sur cet appareil.</p>
        </Card>
      )}
      {SECTIONS.map(({ kind, titre, vide }) => {
        const l = alertes.filter((a) => a.kind === kind)
        return (
          <Card key={kind} title={titre}>
            {l.length ? (
              <ul class="list">
                {l.map((a) => {
                  const j = diffDays(today, a.date)
                  return (
                    <li key={a.uid}>
                      <a class="item" href={'#' + a.lien}>
                        <b>{a.titre}</b>
                        <small>{formatDate(a.date)} · {a.detail}</small>
                      </a>
                      <Badge tone={a.retard ? 'bad' : j <= 7 ? 'warn' : ''}>{j === 0 ? "Aujourd'hui" : j > 0 ? `J-${j}` : `+${-j} j`}</Badge>
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

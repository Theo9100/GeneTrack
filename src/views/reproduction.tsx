import { useState } from 'preact/hooks'
import { blankAnimal, db, save } from '../db'
import type { Animal, Data, Repro, Velage } from '../types'
import { Badge, Card, Empty, Form, Page, animalOptions, go, type FieldDef, type Values } from '../ui'
import { addDays, commonAncestors, diffDays, dueDate, formatDate, isoToday, label, normNumero } from '../logic'

export function ListeRepro({ data }: { data: Data }) {
  const byId = new Map(data.animals.map((a) => [a.id, a]))
  const today = isoToday()
  const enCours = data.repros.filter((r) => !r.velageId && r.diagResultat !== 'vide' && byId.get(r.vacheId)?.statut === 'present').sort((a, b) => dueDate(a, data.gest).localeCompare(dueDate(b, data.gest)))
  const autres = data.repros.filter((r) => !enCours.includes(r)).sort((a, b) => b.date.localeCompare(a.date))

  async function diag(r: Repro, res: 'pleine' | 'vide') {
    await save<Repro>('repros', { ...r, diagResultat: res, diagDate: today })
  }
  const taureau = (r: Repro) => (r.taureauId ? label(byId.get(r.taureauId)) : r.taureauTexte || 'taureau inconnu')

  return (
    <Page title="Reproduction" actions={<><a class="btn small" href="#/velages">Vêlages</a><a class="btn primary small" href="#/repro/new">+ Saillie / IA</a></>}>
      <Card title={`Gestations en cours (${enCours.length})`}>
        {enCours.length ? (
          <ul class="list">
            {enCours.map((r) => {
              const due = dueDate(r, data.gest)
              const j = diffDays(today, due)
              return (
                <li key={r.id}>
                  <a class="item" href={`#/repro/${r.id}`}>
                    <b>{label(byId.get(r.vacheId))}</b> · {r.type === 'IA' ? 'IA' : 'saillie'} {formatDate(r.date)}
                    <small>
                      {taureau(r)} · vêlage prévu le {formatDate(due)} ({j >= 0 ? `dans ${j} j` : `${-j} j de retard`})
                    </small>
                  </a>
                  {r.diagResultat === 'pleine' ? (
                    <Badge>Pleine</Badge>
                  ) : (
                    <span class="row">
                      <button class="small" onClick={() => diag(r, 'pleine')}>Pleine</button>
                      <button class="small" onClick={() => diag(r, 'vide')}>Vide</button>
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        ) : (
          <Empty>Aucune gestation en cours.</Empty>
        )}
      </Card>
      <Card title="Historique">
        {autres.length ? (
          <ul class="list">
            {autres.map((r) => (
              <li key={r.id}>
                <a class="item" href={`#/repro/${r.id}`}>
                  {label(byId.get(r.vacheId))} · {r.type === 'IA' ? 'IA' : 'saillie'} {formatDate(r.date)}
                  <small>{taureau(r)}</small>
                </a>
                {r.velageId ? <Badge>Vêlé</Badge> : r.diagResultat === 'vide' ? <Badge tone="warn">Vide</Badge> : <Badge tone="grey">Clos</Badge>}
              </li>
            ))}
          </ul>
        ) : (
          <Empty>Rien pour le moment.</Empty>
        )}
      </Card>
    </Page>
  )
}

export function FormRepro({ data, id, vache }: { data: Data; id?: string; vache?: string }) {
  const cur = id ? data.repros.find((r) => r.id === id) : undefined
  const [warn, setWarn] = useState<string[]>([])
  if (id && !cur) return <Page title="Introuvable" back="/repro"><Empty>Enregistrement introuvable.</Empty></Page>
  const femelles = data.animals.filter((a) => a.sexe === 'F' && a.statut === 'present')
  const males = data.animals.filter((a) => a.sexe === 'M')
  const fields: FieldDef[] = [
    { name: 'vacheId', label: 'Vache / génisse', type: 'select', required: true, options: animalOptions(femelles, '— choisir —') },
    { name: 'type', label: 'Type', type: 'select', options: [{ value: 'saillie', label: 'Saillie naturelle' }, { value: 'IA', label: 'Insémination (IA)' }] },
    { name: 'date', label: 'Date', type: 'date', required: true },
    { name: 'taureauId', label: 'Taureau du troupeau', type: 'select', options: animalOptions(males, 'Extérieur / semence') },
    { name: 'taureauTexte', label: 'Taureau / semence (extérieur)', show: (v) => !v.taureauId },
    { name: 'diagResultat', label: 'Diagnostic de gestation', type: 'select', options: [{ value: '', label: 'Pas encore fait' }, { value: 'pleine', label: 'Pleine' }, { value: 'vide', label: 'Vide' }] },
    { name: 'diagDate', label: 'Date du diagnostic', type: 'date', show: (v) => !!v.diagResultat },
    { name: 'notes', label: 'Notes', type: 'textarea' },
  ]
  const initial: Values = cur
    ? { vacheId: cur.vacheId, type: cur.type, date: cur.date, taureauId: cur.taureauId, taureauTexte: cur.taureauTexte, diagResultat: cur.diagResultat, diagDate: cur.diagDate, notes: cur.notes }
    : { vacheId: vache ?? '', type: 'saillie', date: isoToday(), taureauId: '', taureauTexte: '', diagResultat: '', diagDate: '', notes: '' }

  const onChange = (v: Values) => {
    const c = commonAncestors(data.animals, String(v.vacheId), String(v.taureauId))
    const names = c.map((i) => label(data.animals.find((a) => a.id === i)))
    setWarn((w) => (w.join() === names.join() ? w : names))
  }

  return (
    <Page title={cur ? 'Modifier saillie / IA' : 'Saillie / IA'} back="/repro">
      <Card>
        <Form
          fields={fields}
          initial={initial}
          onChange={onChange}
          onSubmit={async (v) => {
            if (!v.vacheId) throw new Error('Choisissez la vache.')
            const diagDate = v.diagResultat ? String(v.diagDate || isoToday()) : ''
            await save<Repro>('repros', { velageId: '', ...(cur ?? {}), ...v, taureauTexte: v.taureauId ? '' : String(v.taureauTexte).trim(), diagDate } as Repro)
            go('/repro')
          }}
        >
          {warn.length > 0 && (
            <p class="banner bad">
              ⚠ Consanguinité : ces deux animaux ont des ancêtres communs ({warn.join(', ')}). Un accouplement père-fille ou entre proches apparentés est déconseillé.
            </p>
          )}
          {cur && (
            <button type="button" class="danger" onClick={async () => {
              if (!confirm('Supprimer cet enregistrement ?')) return
              await db.repros.delete(cur.id)
              go('/repro')
            }}>Supprimer</button>
          )}
        </Form>
      </Card>
    </Page>
  )
}

const FACILITE = [
  { value: '1', label: '1 — Sans aide' },
  { value: '2', label: '2 — Aide légère' },
  { value: '3', label: '3 — Traction difficile' },
  { value: '4', label: '4 — Césarienne / très difficile' },
]
const VIGUEUR = [
  { value: '1', label: '1 — Faible' },
  { value: '2', label: '2 — Moyen' },
  { value: '3', label: '3 — Bon' },
  { value: '4', label: '4 — Très vigoureux' },
]

export function ListeVelages({ data }: { data: Data }) {
  const byId = new Map(data.animals.map((a) => [a.id, a]))
  const rows = [...data.velages].sort((a, b) => b.date.localeCompare(a.date))
  return (
    <Page title={`Vêlages (${rows.length})`} back="/repro" actions={<a class="btn primary small" href="#/velages/new">+ Vêlage</a>}>
      <Card>
        {rows.length ? (
          <ul class="list">
            {rows.map((v) => (
              <li key={v.id}>
                <a class="item" href={`#/velages/${v.id}`}>
                  <b>{formatDate(v.date)}</b> · mère {label(byId.get(v.mereId))}
                  <small>{v.morNe ? 'Veau mort-né' : `${label(byId.get(v.veauId))} (${v.sexe === 'F' ? 'femelle' : 'mâle'})`} · facilité {v.facilite}/4 · vigueur {v.vigueur}/4{v.poids ? ` · ${v.poids} kg` : ''}</small>
                </a>
                {v.facilite >= 3 && <Badge tone="warn">Difficile</Badge>}
              </li>
            ))}
          </ul>
        ) : (
          <Empty>Aucun vêlage enregistré.</Empty>
        )}
      </Card>
    </Page>
  )
}

export function FormVelage({ data, id, mere }: { data: Data; id?: string; mere?: string }) {
  const cur = id ? data.velages.find((v) => v.id === id) : undefined
  if (id && !cur) return <Page title="Introuvable" back="/velages"><Empty>Vêlage introuvable.</Empty></Page>
  const femelles = data.animals.filter((a) => a.sexe === 'F' && (a.statut === 'present' || a.id === cur?.mereId))
  const fields: FieldDef[] = [
    { name: 'mereId', label: 'Mère', type: 'select', required: true, options: animalOptions(femelles, '— choisir —') },
    { name: 'date', label: 'Date du vêlage', type: 'date', required: true },
    { name: 'morNe', label: 'Veau mort-né', type: 'checkbox' },
    { name: 'sexe', label: 'Sexe du veau', type: 'select', options: [{ value: 'F', label: 'Femelle' }, { value: 'M', label: 'Mâle' }] },
    ...(cur ? [] : [
      { name: 'numero', label: 'N° national du veau', placeholder: 'peut être ajouté plus tard', show: (v: Values) => !v.morNe },
      { name: 'travail', label: 'N° de travail du veau', show: (v: Values) => !v.morNe },
      { name: 'nom', label: 'Nom du veau', show: (v: Values) => !v.morNe },
    ] as FieldDef[]),
    { name: 'facilite', label: 'Facilité de vêlage', type: 'select', options: FACILITE },
    { name: 'vigueur', label: 'Vigueur du veau', type: 'select', options: VIGUEUR, show: (v) => !v.morNe },
    { name: 'poids', label: 'Poids de naissance (kg)', type: 'number', show: (v) => !v.morNe },
    { name: 'incidents', label: 'Incidents', placeholder: 'ex. veau mal placé, vêlage de nuit…' },
    { name: 'notes', label: 'Notes', type: 'textarea' },
  ]
  const initial: Values = cur
    ? { mereId: cur.mereId, date: cur.date, morNe: cur.morNe, sexe: cur.sexe, facilite: String(cur.facilite), vigueur: String(cur.vigueur), poids: cur.poids === null ? '' : String(cur.poids), incidents: cur.incidents, notes: cur.notes }
    : { mereId: mere ?? '', date: isoToday(), morNe: false, sexe: 'F', numero: '', travail: '', nom: '', facilite: '1', vigueur: '3', poids: '', incidents: '', notes: '' }

  async function onSubmit(v: Values) {
    if (!v.mereId) throw new Error('Choisissez la mère.')
    const date = String(v.date)
    const poids = String(v.poids).trim() === '' || v.morNe ? null : Number(String(v.poids).replace(',', '.'))
    if (poids !== null && !(poids > 0 && poids < 120)) throw new Error('Poids de naissance invalide.')
    if (cur) {
      await save<Velage>('velages', { ...cur, mereId: String(v.mereId), date, morNe: !!v.morNe, sexe: v.sexe as 'F' | 'M', facilite: Number(v.facilite), vigueur: Number(v.vigueur), poids, incidents: String(v.incidents), notes: String(v.notes) })
      return go('/velages')
    }
    // rapprochement avec la saillie / IA correspondante
    const repro = data.repros
      .filter((r) => r.vacheId === v.mereId && !r.velageId && r.diagResultat !== 'vide' && r.date <= date && diffDays(r.date, date) <= 320)
      .sort((a, b) => b.date.localeCompare(a.date))[0]
    let veauId = ''
    if (!v.morNe) {
      const numero = normNumero(String(v.numero))
      const travail = String(v.travail).trim()
      if (!numero && !travail) throw new Error('Indiquez le n° national ou de travail du veau (ou cochez « mort-né »).')
      if (numero && data.animals.some((a) => a.numero === numero)) throw new Error('Ce n° national existe déjà.')
      const veau = await save<Animal>('animals', {
        ...blankAnimal(), numero, travail, nom: String(v.nom).trim(), sexe: v.sexe as 'F' | 'M', naissance: date,
        mereId: String(v.mereId), pereId: repro?.taureauId ?? '', pereTexte: repro?.taureauTexte ?? '',
      })
      veauId = veau.id
    }
    const vel = await save<Velage>('velages', {
      mereId: String(v.mereId), date, veauId, sexe: v.sexe as 'F' | 'M', facilite: Number(v.facilite), vigueur: Number(v.vigueur),
      incidents: String(v.incidents), poids, morNe: !!v.morNe, reproId: repro?.id ?? '', notes: String(v.notes),
    })
    if (repro) await save<Repro>('repros', { ...repro, velageId: vel.id })
    go(veauId ? `/animaux/${veauId}` : '/velages')
  }

  return (
    <Page title={cur ? 'Modifier le vêlage' : 'Nouveau vêlage'} back="/velages">
      <Card>
        <Form fields={fields} initial={initial} onSubmit={onSubmit}>
          {!cur && <small>Le veau est créé automatiquement, lié à sa mère{' '}(et à son père si une saillie/IA est enregistrée).</small>}
          {cur && (
            <button type="button" class="danger" onClick={async () => {
              if (!confirm('Supprimer ce vêlage ? Le veau et la saillie restent enregistrés.')) return
              if (cur.reproId) {
                const r = await db.repros.get(cur.reproId)
                if (r) await save<Repro>('repros', { ...r, velageId: '' })
              }
              await db.velages.delete(cur.id)
              go('/velages')
            }}>Supprimer</button>
          )}
        </Form>
      </Card>
    </Page>
  )
}

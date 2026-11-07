import { useState } from 'preact/hooks'
import { blankAnimal, db, save } from '../db'
import type { Animal, Chaleur, Data, Repro, Velage } from '../types'
import { ChartColumn, Plus } from 'lucide-preact'
import { Badge, Card, DateChip, DeleteBtn, Empty, Form, Page, Tag, animalOptions, go, nameOf, remove, type FieldDef, type Values } from '../ui'
import { planRepro, planSimple, planVelage } from '../remove'
import { agenda, commonAncestors, diffDays, dueDate, formatDate, isoToday, label, normNumero } from '../logic'

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
    <Page title="Reproduction" sub={`${enCours.length} gestation${enCours.length > 1 ? 's' : ''} en cours · ${data.gest} jours de gestation`} actions={<a class="btn primary small" href="#/repro/new"><Plus size={16} />Saillie</a>}>
      <div class="chips">
        <a class="btn small" href="#/repro/bilan"><ChartColumn size={16} />Bilan</a>
        <a class="btn small" href="#/chaleurs/new"><Plus size={16} />Chaleurs observées</a>
        <a class="btn small" href="#/velages/new"><Plus size={16} />Vêlage</a>
        <a class="btn small" href="#/velages">Tous les vêlages</a>
      </div>
      <Card title="Gestations en cours" count={enCours.length}>
        {enCours.length ? (
          <ul class="list">
            {enCours.map((r) => {
              const due = dueDate(r, data.gest)
              const j = diffDays(today, due)
              return (
                <li key={r.id}>
                  <Tag a={byId.get(r.vacheId)} />
                  <a class="item" href={`#/repro/${r.id}`}>
                    <b>{nameOf(byId.get(r.vacheId))}</b>
                    <small>
                      Vêlage le {formatDate(due)} · {j >= 0 ? `dans ${j} j` : `${-j} j de retard`} · {taureau(r)}
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
                  <DeleteBtn onDelete={() => remove(planRepro(data, r))} />
                </li>
              )
            })}
          </ul>
        ) : (
          <Empty>Aucune gestation en cours.</Empty>
        )}
      </Card>
      <CarteChaleurs data={data} />
      <Card title="Historique">
        {autres.length ? (
          <ul class="list">
            {autres.map((r) => (
              <li key={r.id}>
                <DateChip iso={r.date} />
                <a class="item" href={`#/repro/${r.id}`}>
                  <b>{label(byId.get(r.vacheId))}</b>
                  <small>{r.type === 'IA' ? 'IA' : 'Saillie'} · {taureau(r)}</small>
                </a>
                {r.velageId ? <Badge>Vêlé</Badge> : r.diagResultat === 'vide' ? <Badge tone="warn">Vide</Badge> : <Badge tone="grey">Clos</Badge>}
                <DeleteBtn onDelete={() => remove(planRepro(data, r))} />
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
            <button type="button" class="danger" onClick={() => remove(planRepro(data, cur), () => go('/repro'))}>Supprimer cette saillie / IA</button>
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
    <Page title="Vêlages" sub={`${rows.length} vêlage${rows.length > 1 ? 's' : ''} enregistré${rows.length > 1 ? 's' : ''}`} back="/repro" actions={<a class="btn primary small" href="#/velages/new"><Plus size={16} />Vêlage</a>}>
      <Card>
        {rows.length ? (
          <ul class="list">
            {rows.map((v) => (
              <li key={v.id}>
                <DateChip iso={v.date} />
                <a class="item" href={`#/velages/${v.id}`}>
                  <b>{label(byId.get(v.mereId))}</b>
                  <small>{v.morNe ? 'Veau mort-né' : `${label(byId.get(v.veauId))} (${v.sexe === 'F' ? 'femelle' : 'mâle'})`} · facilité {v.facilite}/4 · vigueur {v.vigueur}/4{v.poids ? ` · ${v.poids} kg` : ''}</small>
                </a>
                {v.facilite >= 3 && <Badge tone="warn">Difficile</Badge>}
                <DeleteBtn onDelete={() => remove(planVelage(data, v))} />
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
            <button type="button" class="danger" onClick={() => remove(planVelage(data, cur), () => go('/velages'))}>Supprimer ce vêlage (le veau est conservé)</button>
          )}
        </Form>
      </Card>
    </Page>
  )
}

// ---------- Chaleurs ----------
export function FormChaleur({ data, id, vache }: { data: Data; id?: string; vache?: string }) {
  const cur = id ? data.chaleurs.find((c) => c.id === id) : undefined
  if (id && !cur) return <Page title="Introuvable" back="/repro"><Empty>Observation introuvable.</Empty></Page>
  const femelles = data.animals.filter((a) => a.sexe === 'F' && (a.statut === 'present' || a.id === cur?.vacheId))
  const fields: FieldDef[] = [
    { name: 'vacheId', label: 'Vache / génisse', type: 'select', required: true, options: animalOptions(femelles, '— choisir —') },
    { name: 'date', label: 'Date des chaleurs', type: 'date', required: true },
    { name: 'notes', label: 'Observations', placeholder: 'ex. chevauchements, glaires, agitée…' },
  ]
  const initial: Values = cur ? { vacheId: cur.vacheId, date: cur.date, notes: cur.notes } : { vacheId: vache ?? '', date: isoToday(), notes: '' }
  return (
    <Page title={cur ? 'Modifier les chaleurs' : 'Chaleurs observées'} sub="Prochaines chaleurs prévues 21 jours plus tard" back="/repro">
      <Card>
        <Form
          fields={fields}
          initial={initial}
          onSubmit={async (v) => {
            if (!v.vacheId) throw new Error('Choisissez la vache.')
            await save<Chaleur>('chaleurs', { ...(cur ?? {}), vacheId: String(v.vacheId), date: String(v.date), notes: String(v.notes).trim() } as Chaleur)
            go('/repro')
          }}
        >
          {cur && (
            <button type="button" class="danger" onClick={() => remove(planSimple('chaleurs', cur, 'Chaleurs'), () => go('/repro'))}>Supprimer cette observation</button>
          )}
        </Form>
      </Card>
    </Page>
  )
}

export function CarteChaleurs({ data }: { data: Data }) {
  const byId = new Map(data.animals.map((a) => [a.id, a]))
  const today = isoToday()
  const prevues = agenda(data, today).filter((a) => a.kind === 'chaleur')
  const recentes = [...data.chaleurs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8)
  return (
    <Card title="Chaleurs" count={prevues.length}>
      {prevues.length ? (
        <ul class="list">
          {prevues.map((a) => {
            const j = diffDays(today, a.date)
            return (
              <li key={a.uid}>
                <DateChip iso={a.date} tone={j <= 2 ? 'soon' : ''} />
                <a class="item" href={'#' + a.lien}>
                  <b>{a.titre.replace(/^[^:]+: /, '')}</b>
                  <small>{a.titre.split(' : ')[0]} · {a.detail}</small>
                </a>
                <a class="btn small" href={`#/chaleurs/new?vache=${a.animalIds[0]}`} title="Noter des chaleurs observées">Noter</a>
              </li>
            )
          })}
        </ul>
      ) : (
        <Empty>Aucune chaleur prévue dans les 30 jours. Notez les chaleurs observées pour que l'app calcule les suivantes.</Empty>
      )}
      {recentes.length > 0 && (
        <>
          <div class="section-title" style="margin-top:16px">Dernières observations</div>
          <ul class="list">
            {recentes.map((c) => (
              <li key={c.id}>
                <DateChip iso={c.date} />
                <a class="item" href={`#/chaleurs/${c.id}`}>
                  <b>{label(byId.get(c.vacheId))}</b>
                  {c.notes && <small>{c.notes}</small>}
                </a>
                <DeleteBtn onDelete={() => remove(planSimple('chaleurs', c, 'Chaleurs'))} />
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  )
}

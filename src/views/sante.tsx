import { useState } from 'preact/hooks'
import { db, save } from '../db'
import type { Data, Soin, TypeSoin } from '../types'
import { Plus, Pill } from 'lucide-preact'
import { AnimalPicker, Badge, Card, DateChip, DeleteBtn, Empty, Form, Page, go, remove, type FieldDef, type Values } from '../ui'
import { planSimple } from '../remove'
import { addDays, formatDate, isoToday, label, withdrawalEnd } from '../logic'

const TYPES: { value: TypeSoin; label: string }[] = [
  { value: 'vaccin', label: 'Vaccin' },
  { value: 'vermifuge', label: 'Vermifuge' },
  { value: 'antibiotique', label: 'Antibiotique / traitement' },
  { value: 'autre', label: 'Autre' },
]

export function ListeSoins({ data }: { data: Data }) {
  const byId = new Map(data.animals.map((a) => [a.id, a]))
  const today = isoToday()
  const rappels = data.soins.filter((s) => s.rappelDate && !s.rappelFait).sort((a, b) => a.rappelDate.localeCompare(b.rappelDate))
  const rows = [...data.soins].sort((a, b) => b.date.localeCompare(a.date))
  const who = (s: Soin) => {
    const n = s.animalIds.map((i) => label(byId.get(i)))
    return n.length > 4 ? `${n.slice(0, 4).join(', ')} +${n.length - 4}` : n.join(', ')
  }
  return (
    <Page title="Santé" sub={`${data.soins.length} soin${data.soins.length > 1 ? 's' : ''} enregistré${data.soins.length > 1 ? 's' : ''}`} actions={<a class="btn primary small" href="#/sante/new"><Plus size={16} />Soin</a>}>
      <div class="chips">
        <a class="btn small" href="#/medicaments"><Pill size={16} />Médicaments : posologies et temps d'attente</a>
      </div>
      {rappels.length > 0 && (
        <Card title="Rappels à faire" count={rappels.length}>
          <ul class="list">
            {rappels.map((s) => (
              <li key={s.id}>
                <DateChip iso={s.rappelDate} tone={s.rappelDate < today ? 'late' : ''} />
                <a class="item" href={`#/sante/${s.id}`}>
                  <b style="text-transform:capitalize">{s.type}</b>{s.produit && ` · ${s.produit}`}
                  <small>{who(s)}</small>
                </a>
                <button class="small" onClick={() => save<Soin>('soins', { ...s, rappelFait: true })}>Fait</button>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Card title="Historique des soins">
        {rows.length ? (
          <ul class="list">
            {rows.map((s) => {
              const fin = withdrawalEnd(s.date, s.delaiJours)
              return (
                <li key={s.id}>
                  <DateChip iso={s.date} />
                  <a class="item" href={`#/sante/${s.id}`}>
                    <b style="text-transform:capitalize">{s.type}</b>{s.produit && ` · ${s.produit}`}
                    <small>{who(s)}{fin && ` · attente jusqu'au ${formatDate(fin)}`}</small>
                  </a>
                  {fin >= today && <Badge tone="warn">Délai</Badge>}
                  <DeleteBtn onDelete={() => remove(planSimple('soins', s, 'Soin'))} />
                </li>
              )
            })}
          </ul>
        ) : (
          <Empty>Aucun soin enregistré.</Empty>
        )}
      </Card>
    </Page>
  )
}

export function FormSoin({ data, id, animal, produit, delai: delai0 }: { data: Data; id?: string; animal?: string; produit?: string; delai?: string }) {
  const cur = id ? data.soins.find((s) => s.id === id) : undefined
  const [sel, setSel] = useState<string[]>(cur ? cur.animalIds : animal ? [animal] : [])
  const [delai, setDelai] = useState('')
  const [nomProduit, setNomProduit] = useState(cur?.produit ?? produit ?? '')
  if (id && !cur) return <Page title="Introuvable" back="/sante"><Empty>Soin introuvable.</Empty></Page>
  const pool = data.animals.filter((a) => a.statut === 'present' || cur?.animalIds.includes(a.id))
  const fields: FieldDef[] = [
    { name: 'date', label: 'Date', type: 'date', required: true },
    { name: 'type', label: 'Type', type: 'select', options: TYPES },
    { name: 'produit', label: 'Produit', placeholder: 'ex. Bovilis BVD' },
    { name: 'dose', label: 'Dose', placeholder: 'ex. 2 ml' },
    { name: 'veterinaire', label: 'Vétérinaire prescripteur', placeholder: 'facultatif — pour le registre' },
    { name: 'ordonnance', label: "N° ou date de l'ordonnance", placeholder: 'facultatif — pour le registre' },
    { name: 'delaiJours', label: "Délai d'attente viande (jours)", type: 'number', hint: "0 si aucun. Vérifiez l'ordonnance ou la notice." },
    { name: 'rappelDate', label: 'Date du rappel', type: 'date', hint: 'Laissez vide s’il n’y a pas de rappel.' },
    { name: 'rappelFait', label: 'Rappel effectué', type: 'checkbox', show: (v) => !!v.rappelDate },
    { name: 'notes', label: 'Notes', type: 'textarea' },
  ]
  const initial: Values = cur
    ? { date: cur.date, type: cur.type, produit: cur.produit, dose: cur.dose, veterinaire: cur.veterinaire ?? '', ordonnance: cur.ordonnance ?? '', delaiJours: String(cur.delaiJours), rappelDate: cur.rappelDate, rappelFait: cur.rappelFait, notes: cur.notes }
    : { date: isoToday(), type: 'vaccin', produit: produit ?? '', dose: '', veterinaire: '', ordonnance: '', delaiJours: delai0 ?? '0', rappelDate: '', rappelFait: false, notes: '' }
  return (
    <Page title={cur ? 'Modifier le soin' : 'Nouveau soin'} back="/sante">
      <Card>
        <Form
          fields={fields}
          initial={initial}
          onChange={(v) => {
            setDelai(String(v.delaiJours))
            setNomProduit(String(v.produit))
          }}
          onSubmit={async (v) => {
            if (!sel.length) throw new Error('Sélectionnez au moins un animal.')
            const delaiJours = Math.max(0, Math.round(Number(String(v.delaiJours).replace(',', '.')) || 0))
            await save<Soin>('soins', {
              ...(cur ?? {}), animalIds: sel, date: String(v.date), type: v.type as TypeSoin, produit: String(v.produit).trim(), dose: String(v.dose).trim(),
              veterinaire: String(v.veterinaire ?? '').trim(), ordonnance: String(v.ordonnance ?? '').trim(),
              delaiJours, rappelDate: String(v.rappelDate), rappelFait: v.rappelDate ? !!v.rappelFait : false, notes: String(v.notes),
            } as Soin)
            go('/sante')
          }}
        >
          <a class="btn small" href={`#/medicaments${nomProduit.trim() ? '?q=' + encodeURIComponent(nomProduit.trim()) : ''}`}>
            <Pill size={16} />
            {nomProduit.trim() ? `Posologie de « ${nomProduit.trim()} »` : 'Chercher une posologie'}
          </a>
          {produit && delai0 && <small>Délai d'attente viande pré-rempli d'après le RCP officiel ({delai0} j) : vérifiez-le avec l'ordonnance.</small>}
          <label>
            <span>Animaux concernés *</span>
            <AnimalPicker animals={pool} selected={sel} onChange={setSel} />
          </label>
          {Number(delai) > 0 && <small>Délai d'attente calculé à partir de la date du soin ({formatDate(addDays(isoToday(), Number(delai)))} si fait aujourd'hui).</small>}
          {cur && (
            <button type="button" class="danger" onClick={() => remove(planSimple('soins', cur, 'Soin'), () => go('/sante'))}>Supprimer ce soin</button>
          )}
        </Form>
      </Card>
    </Page>
  )
}

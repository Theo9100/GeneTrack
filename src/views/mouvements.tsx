import { useState } from 'preact/hooks'
import { db, save } from '../db'
import type { Animal, Data, Mouvement, Statut, TypeMouvement } from '../types'
import { Plus } from 'lucide-preact'
import { AnimalPicker, Badge, Card, DateChip, Empty, Form, Page, go, type FieldDef, type Values } from '../ui'
import { formatDate, isoToday, label } from '../logic'

export const MVT_LABEL: Record<TypeMouvement, string> = { entree: 'Entrée', vente: 'Vente', mort: 'Mort', reforme: 'Réforme' }
const STATUT_APRES: Partial<Record<TypeMouvement, Statut>> = { vente: 'vendu', mort: 'mort', reforme: 'reforme' }

export function ListeMouvements({ data }: { data: Data }) {
  const byId = new Map(data.animals.map((a) => [a.id, a]))
  const rows = [...data.mouvements].sort((a, b) => b.date.localeCompare(a.date))
  const total = data.mouvements.filter((m) => m.type === 'vente' && m.date.slice(0, 4) === isoToday().slice(0, 4))
  const ca = total.reduce((s, m) => s + (m.prix ?? 0), 0)
  return (
    <Page title="Mouvements" sub="Ventes, entrées, morts et réformes" actions={<a class="btn primary small" href="#/mouvements/new"><Plus size={16} />Mouvement</a>}>
      {total.length > 0 && (
        <Card>
          <div class="stats" style="grid-template-columns:1fr 1fr">
            <div><b>{total.length}</b><span>Vente{total.length > 1 ? 's' : ''} cette année</span></div>
            <div><b>{ca > 0 ? ca.toLocaleString('fr-FR') + ' €' : '—'}</b><span>Chiffre d'affaires</span></div>
          </div>
        </Card>
      )}
      <Card>
        {rows.length ? (
          <ul class="list">
            {rows.map((m) => (
              <li key={m.id}>
                <DateChip iso={m.date} />
                <a class="item" href={`#/mouvements/${m.id}`}>
                  <b>{label(byId.get(m.animalId))}</b>
                  <small>
                    {m.acheteur}{m.poids ? ` · ${m.poids} kg` : ''}{m.prix ? ` · ${m.prix.toLocaleString('fr-FR')} €` : ''}
                  </small>
                </a>
                <Badge tone={m.type === 'entree' ? '' : m.type === 'vente' ? 'grey' : 'bad'}>{MVT_LABEL[m.type]}</Badge>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>Aucun mouvement enregistré.</Empty>
        )}
      </Card>
    </Page>
  )
}

const num = (s: unknown) => (String(s).trim() === '' ? null : Number(String(s).replace(',', '.')))

export function FormMouvement({ data, id, animal }: { data: Data; id?: string; animal?: string }) {
  const cur = id ? data.mouvements.find((m) => m.id === id) : undefined
  const [sel, setSel] = useState<string[]>(animal ? [animal] : [])
  if (id && !cur) return <Page title="Introuvable" back="/mouvements"><Empty>Mouvement introuvable.</Empty></Page>
  const fields: FieldDef[] = [
    {
      name: 'type', label: 'Type', type: 'select',
      options: (Object.keys(MVT_LABEL) as TypeMouvement[]).map((value) => ({ value, label: MVT_LABEL[value] })),
    },
    { name: 'date', label: 'Date', type: 'date', required: true },
    { name: 'acheteur', label: 'Acheteur / négociant / origine', show: (v) => v.type === 'vente' || v.type === 'reforme' || v.type === 'entree' },
    { name: 'poids', label: 'Poids (kg)', type: 'number', show: (v) => v.type === 'vente' || v.type === 'reforme' },
    { name: 'prix', label: cur ? 'Prix (€)' : 'Prix par animal (€)', type: 'number', show: (v) => v.type === 'vente' || v.type === 'reforme' || v.type === 'entree' },
    { name: 'notes', label: 'Notes', type: 'textarea' },
  ]
  const initial: Values = cur
    ? { type: cur.type, date: cur.date, acheteur: cur.acheteur, poids: cur.poids === null ? '' : String(cur.poids), prix: cur.prix === null ? '' : String(cur.prix), notes: cur.notes }
    : { type: 'vente', date: isoToday(), acheteur: '', poids: '', prix: '', notes: '' }

  async function applyStatus(a: Animal, type: TypeMouvement, date: string) {
    const st = STATUT_APRES[type]
    if (st) await save<Animal>('animals', { ...a, statut: st, dateSortie: date })
  }

  async function onSubmit(v: Values) {
    const type = v.type as TypeMouvement
    const date = String(v.date)
    const poids = num(v.poids)
    const prix = num(v.prix)
    if ((poids !== null && !(poids > 0)) || (prix !== null && prix < 0)) throw new Error('Poids ou prix invalide.')
    const common = { type, date, acheteur: String(v.acheteur ?? '').trim(), poids: type === 'mort' ? null : poids, prix: type === 'mort' ? null : prix, notes: String(v.notes) }
    if (cur) {
      await save<Mouvement>('mouvements', { ...cur, ...common, type: cur.type })
      const a = data.animals.find((x) => x.id === cur.animalId)
      if (a && STATUT_APRES[cur.type] && a.statut === STATUT_APRES[cur.type]) await save<Animal>('animals', { ...a, dateSortie: date })
      return go('/mouvements')
    }
    if (!sel.length) throw new Error('Sélectionnez au moins un animal.')
    for (const aid of sel) {
      await save<Mouvement>('mouvements', { ...common, animalId: aid })
      const a = data.animals.find((x) => x.id === aid)
      if (a) await applyStatus(a, type, date)
    }
    go('/mouvements')
  }

  return (
    <Page title={cur ? 'Modifier le mouvement' : 'Nouveau mouvement'} back="/mouvements">
      <Card>
        <Form fields={fields} initial={initial} onSubmit={onSubmit}>
          {cur ? (
            <small>Animal : {label(data.animals.find((a) => a.id === cur.animalId))}</small>
          ) : (
            <label>
              <span>Animaux concernés *</span>
              <AnimalPicker animals={data.animals.filter((a) => a.statut === 'present')} selected={sel} onChange={setSel} />
              <small>Pour une vente de plusieurs animaux, cochez-les tous : un mouvement est créé pour chacun avec le même acheteur, la même date et le même prix.</small>
            </label>
          )}
          {cur && (
            <button type="button" class="danger" onClick={async () => {
              if (!confirm('Supprimer ce mouvement ?' + (STATUT_APRES[cur.type] ? ' L’animal repassera « présent ».' : ''))) return
              const a = data.animals.find((x) => x.id === cur.animalId)
              if (a && STATUT_APRES[cur.type] === a.statut) await save<Animal>('animals', { ...a, statut: 'present', dateSortie: '' })
              await db.mouvements.delete(cur.id)
              go('/mouvements')
            }}>Supprimer</button>
          )}
        </Form>
      </Card>
    </Page>
  )
}

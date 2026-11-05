import { useMemo, useState } from 'preact/hooks'
import { CalendarHeart, ChevronRight, Pencil, Plus, Syringe, Truck, Baby } from 'lucide-preact'
import { blankAnimal, db, save } from '../db'
import type { Animal, Data, Statut } from '../types'
import { Badge, Card, DateChip, Empty, Form, Page, SearchInput, Sex, Tag, animalOptions, go, nameOf, type FieldDef } from '../ui'
import { FamilyTree } from '../tree'
import {
  CATEGORIE_LABEL, calvedSet, categorie, dueDate, formatAge, formatDate, isoToday, label, normNumero, shortId, withdrawalEnd,
} from '../logic'

export const STATUT_LABEL: Record<Statut, string> = { present: 'Présent', vendu: 'Vendu', mort: 'Mort', reforme: 'Réformé' }
const statutTone = (s: Statut) => (s === 'present' ? '' : s === 'vendu' ? 'grey' : 'bad')

export function ListeAnimaux({ data }: { data: Data }) {
  const [q, setQ] = useState('')
  const [statut, setStatut] = useState('present')
  const [cat, setCat] = useState('')
  const [sexe, setSexe] = useState('')
  const today = isoToday()
  const calved = useMemo(() => calvedSet(data.animals, data.velages), [data])
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase().replace(/\s+/g, '')
    return data.animals
      .map((a) => ({ a, c: categorie(a, today, calved) }))
      .filter(({ a, c }) => (!statut || a.statut === statut) && (!cat || c === cat) && (!sexe || a.sexe === sexe))
      .filter(({ a }) => !s || (a.numero + a.travail + a.nom).toLowerCase().replace(/\s+/g, '').includes(s))
      .sort((x, y) => shortId(x.a).localeCompare(shortId(y.a), 'fr', { numeric: true }))
  }, [data, q, statut, cat, sexe])
  return (
    <Page
      title="Animaux"
      sub={`${rows.length} ${rows.length > 1 ? 'animaux' : 'animal'}${statut === 'present' ? (rows.length > 1 ? ' présents' : ' présent') : ''}`}
      actions={<a class="btn primary small" href="#/animaux/new"><Plus size={16} />Animal</a>}
    >
      <SearchInput value={q} onInput={setQ} placeholder="Boucle, n° de travail ou nom" />
      <div class="filters">
        <select value={statut} onChange={(e) => setStatut(e.currentTarget.value)}>
          <option value="present">Présents</option>
          <option value="">Tous</option>
          <option value="vendu">Vendus</option>
          <option value="mort">Morts</option>
          <option value="reforme">Réformés</option>
        </select>
        <select value={cat} onChange={(e) => setCat(e.currentTarget.value)}>
          <option value="">Catégories</option>
          {Object.entries(CATEGORIE_LABEL).map(([k, v]) => (
            <option value={k}>{v}</option>
          ))}
        </select>
        <select value={sexe} onChange={(e) => setSexe(e.currentTarget.value)}>
          <option value="">Sexes</option>
          <option value="F">Femelles</option>
          <option value="M">Mâles</option>
        </select>
      </div>
      <Card>
        {rows.length ? (
          <ul class="list">
            {rows.map(({ a, c }) => (
              <li key={a.id}>
                <Tag a={a} />
                <a class="item" href={`#/animaux/${a.id}`}>
                  <b>{nameOf(a) || <span style="color:var(--ink-3)">Sans nom</span>}</b>
                  <small>
                    <Sex s={a.sexe} />
                    {CATEGORIE_LABEL[c]} · {formatAge(a.naissance, today) || 'âge inconnu'}
                  </small>
                </a>
                <span class="trail">
                  {a.statut !== 'present' && <Badge tone={statutTone(a.statut)}>{STATUT_LABEL[a.statut]}</Badge>}
                  <ChevronRight size={18} class="chev" />
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>{data.animals.length ? 'Aucun animal ne correspond.' : 'Aucun animal pour le moment. Ajoutez le premier avec « Animal ».'}</Empty>
        )}
      </Card>
    </Page>
  )
}

export function FormAnimal({ data, id, mere }: { data: Data; id?: string; mere?: string }) {
  const cur = id ? data.animals.find((a) => a.id === id) : undefined
  if (id && !cur) return <Page title="Animal introuvable" back="/animaux"><Empty>Cet animal n'existe pas.</Empty></Page>
  const base = cur ?? { ...blankAnimal(), mereId: mere ?? '' }
  const femelles = data.animals.filter((a) => a.sexe === 'F' && a.id !== id)
  const males = data.animals.filter((a) => a.sexe === 'M' && a.id !== id)
  const fields: FieldDef[] = [
    { name: 'numero', label: 'N° national (boucle)', placeholder: 'FR 1234 5678 90', hint: 'Au moins le n° national ou le n° de travail.' },
    { name: 'travail', label: 'N° de travail', placeholder: 'ex. 4521' },
    { name: 'nom', label: 'Nom' },
    { name: 'sexe', label: 'Sexe', type: 'select', options: [{ value: 'F', label: 'Femelle' }, { value: 'M', label: 'Mâle' }] },
    { name: 'naissance', label: 'Date de naissance', type: 'date' },
    { name: 'mereId', label: 'Mère', type: 'select', options: animalOptions(femelles, 'Inconnue / extérieure') },
    { name: 'pereId', label: 'Père (du troupeau)', type: 'select', options: animalOptions(males, 'Inconnu / extérieur') },
    { name: 'pereTexte', label: 'Père (extérieur)', placeholder: 'Nom ou n° du taureau / semence', show: (v) => !v.pereId },
    {
      name: 'statut', label: 'Statut', type: 'select',
      options: Object.entries(STATUT_LABEL).map(([value, label]) => ({ value, label })),
    },
    { name: 'dateSortie', label: 'Date de sortie', type: 'date', show: (v) => v.statut !== 'present' },
    { name: 'notes', label: 'Notes', type: 'textarea' },
  ]
  const initial = Object.fromEntries(Object.entries(base).filter(([k]) => !['id', 'updatedAt'].includes(k))) as any
  return (
    <Page title={cur ? 'Modifier ' + label(cur) : 'Nouvel animal'} back={cur ? `/animaux/${cur.id}` : '/animaux'}>
      <Card>
        <Form
          fields={fields}
          initial={initial}
          onSubmit={async (v) => {
            const numero = normNumero(String(v.numero))
            const travail = String(v.travail).trim()
            if (!numero && !travail) throw new Error('Renseignez le n° national ou le n° de travail.')
            if (numero && data.animals.some((a) => a.numero === numero && a.id !== id)) throw new Error('Ce n° national existe déjà.')
            if (travail && data.animals.some((a) => a.travail === travail && a.id !== id && a.statut === 'present')) throw new Error('Ce n° de travail est déjà utilisé par un animal présent.')
            if (v.statut !== 'present' && !v.dateSortie) v.dateSortie = isoToday()
            const row = { ...(cur ?? {}), ...v, numero, travail, nom: String(v.nom).trim(), pereTexte: v.pereId ? '' : String(v.pereTexte).trim(), dateSortie: v.statut === 'present' ? '' : v.dateSortie } as Animal
            const saved = await save<Animal>('animals', row)
            go(`/animaux/${saved.id}`)
          }}
        />
      </Card>
    </Page>
  )
}

export function FicheAnimal({ data, id }: { data: Data; id: string }) {
  const a = data.animals.find((x) => x.id === id)
  const today = isoToday()
  const calved = useMemo(() => calvedSet(data.animals, data.velages), [data])
  if (!a) return <Page title="Animal introuvable" back="/animaux"><Empty>Cet animal n'existe pas.</Empty></Page>
  const map = new Map(data.animals.map((x) => [x.id, x]))
  const enfants = data.animals.filter((x) => x.mereId === id || x.pereId === id)
  const repros = data.repros.filter((r) => r.vacheId === id || r.taureauId === id).sort((x, y) => y.date.localeCompare(x.date))
  const velages = data.velages.filter((v) => v.mereId === id || v.veauId === id).sort((x, y) => y.date.localeCompare(x.date))
  const soins = data.soins.filter((s) => s.animalIds.includes(id)).sort((x, y) => y.date.localeCompare(x.date))
  const mvts = data.mouvements.filter((m) => m.animalId === id).sort((x, y) => y.date.localeCompare(x.date))
  const refs = enfants.length + repros.length + velages.length + soins.length + mvts.length
  const c = categorie(a, today, calved)
  const enAttente = soins.some((s) => withdrawalEnd(s.date, s.delaiJours) >= today)

  async function supprimer() {
    if (refs) return alert("Cet animal est lié à d'autres enregistrements (descendants, reproduction, soins, mouvements). Changez plutôt son statut.")
    if (!confirm(`Supprimer définitivement ${label(a)} ?`)) return
    await db.animals.delete(a!.id)
    go('/animaux')
  }

  return (
    <Page
      title={label(a)}
      back="/animaux"
      head={
        <div class="hero">
          <Tag a={a} size="lg" />
          <h1>{a.nom || CATEGORIE_LABEL[c]}</h1>
        </div>
      }
      sub={
        <span class="row" style="gap:6px;margin-top:6px">
          <Badge tone="accent">{CATEGORIE_LABEL[c]}</Badge>
          {a.statut !== 'present' && <Badge tone={statutTone(a.statut)}>{STATUT_LABEL[a.statut]}</Badge>}
          {enAttente && <Badge tone="warn">Délai d'attente</Badge>}
        </span>
      }
      actions={<a class="btn icon-btn" href={`#/animaux/${id}/edit`} aria-label="Modifier" title="Modifier"><Pencil size={17} /></a>}
    >
      <Card title="Généalogie">
        <FamilyTree animals={data.animals} id={id} selfRole={CATEGORIE_LABEL[c]} />
      </Card>

      {a.statut === 'present' && (
        <div class="chips">
          {a.sexe === 'F' && <a class="btn small" href={`#/repro/new?vache=${id}`}><CalendarHeart size={16} />Saillie / IA</a>}
          {a.sexe === 'F' && <a class="btn small" href={`#/velages/new?mere=${id}`}><Baby size={16} />Vêlage</a>}
          <a class="btn small" href={`#/sante/new?animal=${id}`}><Syringe size={16} />Soin</a>
          <a class="btn small" href={`#/mouvements/new?animal=${id}`}><Truck size={16} />Vente / sortie</a>
        </div>
      )}

      <Card title="Informations">
        <dl class="facts">
          <div><dt>N° national</dt><dd>{a.numero || '—'}</dd></div>
          <div><dt>N° de travail</dt><dd>{a.travail || '—'}</dd></div>
          <div><dt>Sexe</dt><dd><Sex s={a.sexe} />{a.sexe === 'F' ? 'Femelle' : 'Mâle'}</dd></div>
          <div><dt>Naissance</dt><dd>{a.naissance ? formatDate(a.naissance) : '—'}</dd></div>
          <div><dt>Âge</dt><dd>{formatAge(a.naissance, today) || '—'}</dd></div>
          {a.dateSortie && <div><dt>Sortie</dt><dd>{formatDate(a.dateSortie)}</dd></div>}
        </dl>
        {a.notes && <p style="margin:14px 0 0;color:var(--ink-2)">{a.notes}</p>}
      </Card>

      {repros.length > 0 && (
        <Card title="Reproduction" count={repros.length}>
          <ul class="list">
            {repros.map((r) => (
              <li key={r.id}>
                <DateChip iso={r.date} />
                <a class="item" href={`#/repro/${r.id}`}>
                  <b>{r.type === 'IA' ? 'Insémination' : 'Saillie'}</b>{r.vacheId !== id && <> · {label(map.get(r.vacheId))}</>}
                  <small>Vêlage prévu le {formatDate(dueDate(r, data.gest))}</small>
                </a>
                {r.velageId ? <Badge>Vêlé</Badge> : r.diagResultat === 'pleine' ? <Badge>Pleine</Badge> : r.diagResultat === 'vide' ? <Badge tone="warn">Vide</Badge> : null}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {velages.length > 0 && (
        <Card title="Vêlages" count={velages.length}>
          <ul class="list">
            {velages.map((v) => (
              <li key={v.id}>
                <DateChip iso={v.date} />
                <a class="item" href={`#/velages/${v.id}`}>
                  <b>{v.morNe ? 'Veau mort-né' : v.veauId === id ? 'Naissance' : label(map.get(v.veauId))}</b>
                  <small>Facilité {v.facilite}/4 · vigueur {v.vigueur}/4{v.poids ? ` · ${v.poids} kg` : ''}</small>
                </a>
                {v.facilite >= 3 && <Badge tone="warn">Difficile</Badge>}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {soins.length > 0 && (
        <Card title="Santé" count={soins.length}>
          <ul class="list">
            {soins.map((s) => {
              const fin = withdrawalEnd(s.date, s.delaiJours)
              return (
                <li key={s.id}>
                  <DateChip iso={s.date} />
                  <a class="item" href={`#/sante/${s.id}`}>
                    <b style="text-transform:capitalize">{s.type}</b>{s.produit && ` · ${s.produit}`}
                    {fin && <small>Délai d'attente jusqu'au {formatDate(fin)}</small>}
                  </a>
                  {fin >= today && <Badge tone="warn">Délai</Badge>}
                </li>
              )
            })}
          </ul>
        </Card>
      )}

      {mvts.length > 0 && (
        <Card title="Mouvements" count={mvts.length}>
          <ul class="list">
            {mvts.map((m) => (
              <li key={m.id}>
                <DateChip iso={m.date} />
                <a class="item" href={`#/mouvements/${m.id}`}>
                  <b style="text-transform:capitalize">{m.type === 'entree' ? 'Entrée' : m.type}</b>{m.acheteur && ` · ${m.acheteur}`}
                  {(m.poids || m.prix) && <small>{[m.poids && `${m.poids} kg`, m.prix && `${m.prix.toLocaleString('fr-FR')} €`].filter(Boolean).join(' · ')}</small>}
                </a>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <button class="danger small" onClick={supprimer}>Supprimer cet animal</button>
    </Page>
  )
}

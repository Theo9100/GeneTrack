import { useMemo, useState } from 'preact/hooks'
import { blankAnimal, db, save } from '../db'
import type { Animal, Data, Statut } from '../types'
import { Badge, Card, Empty, Form, Page, animalOptions, go, type FieldDef } from '../ui'
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
    <Page title={`Animaux (${rows.length})`} actions={<a class="btn primary small" href="#/animaux/new">+ Animal</a>}>
      <input class="search" type="search" placeholder="N° de boucle (4 derniers chiffres), travail ou nom" value={q} onInput={(e) => setQ(e.currentTarget.value)} />
      <div class="filters">
        <select value={statut} onChange={(e) => setStatut(e.currentTarget.value)}>
          <option value="present">Présents</option>
          <option value="">Tous statuts</option>
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
                <a class="item" href={`#/animaux/${a.id}`}>
                  <span class="big4">{shortId(a)}</span> {a.nom && <b>{a.nom}</b>}
                  <small>
                    {CATEGORIE_LABEL[c]} · {formatAge(a.naissance, today) || 'âge inconnu'}
                    {a.travail && a.numero ? ` · …${a.numero.slice(-4)}` : ''}
                  </small>
                </a>
                {a.statut !== 'present' && <Badge tone={statutTone(a.statut)}>{STATUT_LABEL[a.statut]}</Badge>}
              </li>
            ))}
          </ul>
        ) : (
          <Empty>{data.animals.length ? 'Aucun animal ne correspond.' : 'Aucun animal pour le moment. Ajoutez le premier avec « + Animal ».'}</Empty>
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

function Arbre({ animals, id, depth }: { animals: Map<string, Animal>; id: string; depth: number }) {
  const a = animals.get(id)
  if (!a || depth === 0) return null
  const parents: [string, string, string][] = [['Mère', a.mereId, ''], ['Père', a.pereId, a.pereTexte]]
  return (
    <ul class="tree">
      {parents.map(([role, pid, texte]) => {
        const p = pid ? animals.get(pid) : undefined
        return (
          <li key={role}>
            {role} : {p ? <a href={`#/animaux/${p.id}`}>{label(p)}</a> : texte || <small>inconnu</small>}
            {p && <Arbre animals={animals} id={p.id} depth={depth - 1} />}
          </li>
        )
      })}
    </ul>
  )
}

export function FicheAnimal({ data, id }: { data: Data; id: string }) {
  const a = data.animals.find((x) => x.id === id)
  const today = isoToday()
  const calved = useMemo(() => calvedSet(data.animals, data.velages), [data])
  if (!a) return <Page title="Animal introuvable" back="/animaux"><Empty>Cet animal n'existe pas.</Empty></Page>
  const map = new Map(data.animals.map((x) => [x.id, x]))
  const enfants = data.animals.filter((x) => x.mereId === id || x.pereId === id).sort((x, y) => y.naissance.localeCompare(x.naissance))
  const repros = data.repros.filter((r) => r.vacheId === id || r.taureauId === id).sort((x, y) => y.date.localeCompare(x.date))
  const velages = data.velages.filter((v) => v.mereId === id || v.veauId === id).sort((x, y) => y.date.localeCompare(x.date))
  const soins = data.soins.filter((s) => s.animalIds.includes(id)).sort((x, y) => y.date.localeCompare(x.date))
  const mvts = data.mouvements.filter((m) => m.animalId === id).sort((x, y) => y.date.localeCompare(x.date))
  const refs = enfants.length + repros.length + velages.length + soins.length + mvts.length
  const c = categorie(a, today, calved)

  async function supprimer() {
    if (refs) return alert("Cet animal est lié à d'autres enregistrements (descendants, reproduction, soins, mouvements). Changez plutôt son statut.")
    if (!confirm(`Supprimer définitivement ${label(a)} ?`)) return
    await db.animals.delete(a!.id)
    go('/animaux')
  }

  return (
    <Page title={label(a)} back="/animaux" actions={<a class="btn small" href={`#/animaux/${id}/edit`}>Modifier</a>}>
      <Card>
        <div class="row" style="margin-bottom:8px">
          <Badge>{CATEGORIE_LABEL[c]}</Badge>
          <Badge tone={statutTone(a.statut)}>{STATUT_LABEL[a.statut]}</Badge>
        </div>
        <dl>
          <dt>N° national</dt><dd>{a.numero || '—'}</dd>
          <dt>N° de travail</dt><dd>{a.travail || '—'}</dd>
          <dt>Sexe</dt><dd>{a.sexe === 'F' ? 'Femelle' : 'Mâle'}</dd>
          <dt>Naissance</dt><dd>{a.naissance ? `${formatDate(a.naissance)} (${formatAge(a.naissance, today)})` : '—'}</dd>
          {a.dateSortie && (<><dt>Sortie</dt><dd>{formatDate(a.dateSortie)}</dd></>)}
        </dl>
        {a.notes && <p>{a.notes}</p>}
      </Card>

      {a.statut === 'present' && (
        <div class="row" style="margin-bottom:12px">
          {a.sexe === 'F' && <a class="btn small" href={`#/repro/new?vache=${id}`}>+ Saillie / IA</a>}
          {a.sexe === 'F' && <a class="btn small" href={`#/velages/new?mere=${id}`}>+ Vêlage</a>}
          <a class="btn small" href={`#/sante/new?animal=${id}`}>+ Soin</a>
          <a class="btn small" href={`#/mouvements/new?animal=${id}`}>Vente / sortie</a>
        </div>
      )}

      <Card title="Généalogie">
        {a.mereId || a.pereId || a.pereTexte ? <Arbre animals={map} id={id} depth={3} /> : <Empty>Parents inconnus.</Empty>}
      </Card>

      {enfants.length > 0 && (
        <Card title={`Descendants (${enfants.length})`}>
          <ul class="list">
            {enfants.map((e) => (
              <li key={e.id}>
                <a class="item" href={`#/animaux/${e.id}`}>
                  <b>{label(e)}</b> <small>{e.mereId === id ? 'Mère' : 'Père'} · né(e) {formatDate(e.naissance) || '?'}</small>
                </a>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {repros.length > 0 && (
        <Card title="Reproduction">
          <ul class="list">
            {repros.map((r) => (
              <li key={r.id}>
                <a class="item" href={`#/repro/${r.id}`}>
                  {r.type === 'IA' ? 'IA' : 'Saillie'} {formatDate(r.date)} · {label(map.get(r.vacheId))}
                  <small>Vêlage prévu {formatDate(dueDate(r, data.gest))}{r.diagResultat && ` · ${r.diagResultat}`}</small>
                </a>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {velages.length > 0 && (
        <Card title="Vêlages">
          <ul class="list">
            {velages.map((v) => (
              <li key={v.id}>
                <a class="item" href={`#/velages/${v.id}`}>
                  {formatDate(v.date)} · {v.morNe ? 'veau mort-né' : label(map.get(v.veauId))}
                  <small>Mère {label(map.get(v.mereId))} · facilité {v.facilite}/4</small>
                </a>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {soins.length > 0 && (
        <Card title="Santé">
          <ul class="list">
            {soins.map((s) => {
              const fin = withdrawalEnd(s.date, s.delaiJours)
              return (
                <li key={s.id}>
                  <a class="item" href={`#/sante/${s.id}`}>
                    {formatDate(s.date)} · {s.type}{s.produit && ` · ${s.produit}`}
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
        <Card title="Mouvements">
          <ul class="list">
            {mvts.map((m) => (
              <li key={m.id}>
                <a class="item" href={`#/mouvements/${m.id}`}>
                  {formatDate(m.date)} · {m.type}{m.acheteur && ` · ${m.acheteur}`}
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

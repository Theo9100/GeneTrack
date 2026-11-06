import { useMemo, useState } from 'preact/hooks'
import { CalendarHeart, ChevronRight, Download, Flame, Pencil, Plus, SlidersHorizontal, Syringe, Truck, Baby, X } from 'lucide-preact'
import { ETAT_REPRO_LABEL, FILTRES_DEFAUT, TRI_LABEL, anneesNaissance, filtrer, filtresActifs, lignes, meres, peres, type Filtres, type Tri } from '../filtres'
import { blankAnimal, save } from '../db'
import type { Animal, Data, Statut } from '../types'
import { Badge, Card, DateChip, DeleteBtn, Empty, Form, Page, SearchInput, Sex, Tag, animalOptions, download, go, nameOf, remove, type FieldDef } from '../ui'
import { linkedCount, linkedSummary, planAnimal, planMouvement, planRepro, planSimple, planSoinPourAnimal, planVelage } from '../remove'
import { FamilyTree } from '../tree'
import {
  CATEGORIE_LABEL, calvedSet, categorie, dueDate, formatAge, formatDate, isoToday, label, normNumero, prochaineChaleur, toCSV, withdrawalEnd,
} from '../logic'

export const STATUT_LABEL: Record<Statut, string> = { present: 'Présent', vendu: 'Vendu', mort: 'Mort', reforme: 'Réformé' }
const statutTone = (s: Statut) => (s === 'present' ? '' : s === 'vendu' ? 'grey' : 'bad')

const CLE_FILTRES = 'gt-filtres'
function lireFiltres(): Filtres {
  try {
    return { ...FILTRES_DEFAUT, ...JSON.parse(localStorage.getItem(CLE_FILTRES) || '{}') }
  } catch {
    return FILTRES_DEFAUT
  }
}

export function ListeAnimaux({ data }: { data: Data }) {
  const [q, setQ] = useState('')
  const [f, setF] = useState<Filtres>(lireFiltres)
  const [ouvert, setOuvert] = useState(false)
  const today = isoToday()
  const set = <K extends keyof Filtres>(k: K, v: Filtres[K]) => {
    const nf = { ...f, [k]: v }
    setF(nf)
    try {
      localStorage.setItem(CLE_FILTRES, JSON.stringify(nf))
    } catch {
      /* stockage indisponible : filtres non mémorisés */
    }
  }
  const reset = () => {
    setF(FILTRES_DEFAUT)
    try {
      localStorage.removeItem(CLE_FILTRES)
    } catch {
      /* rien */
    }
  }
  const toutes = useMemo(() => lignes(data, today), [data])
  const rows = useMemo(() => filtrer(toutes, f, q), [toutes, f, q])
  const actifs = filtresActifs(f, data.animals)
  const byId = new Map(data.animals.map((a) => [a.id, a]))
  const exporter = () =>
    download(
      `genetrack-animaux-filtres-${today}.csv`,
      toCSV(
        rows.map(({ a, c, etat, velage }) => ({
          ...a, categorie: CATEGORIE_LABEL[c], reproduction: etat ? ETAT_REPRO_LABEL[etat] : '', velagePrevu: velage,
          mere: a.mereId ? label(byId.get(a.mereId)) : '', pere: a.pereId ? label(byId.get(a.pereId)) : a.pereTexte,
        })),
        ['numero', 'travail', 'nom', 'sexe', 'naissance', 'categorie', 'mere', 'pere', 'statut', 'reproduction', 'velagePrevu', 'notes'],
      ),
      'text/csv;charset=utf-8',
    )

  return (
    <Page
      title="Animaux"
      sub={`${rows.length} ${rows.length > 1 ? 'animaux' : 'animal'}${f.statut === 'present' ? (rows.length > 1 ? ' présents' : ' présent') : ''}${actifs.length ? ' · filtrés' : ''}`}
      actions={<a class="btn primary small" href="#/animaux/new"><Plus size={16} />Animal</a>}
    >
      <SearchInput value={q} onInput={setQ} placeholder="Boucle, n° de travail ou nom" />
      <div class="filters four">
        <select value={f.statut} onChange={(e) => set('statut', e.currentTarget.value as Filtres['statut'])} aria-label="Statut">
          <option value="present">Présents</option>
          <option value="">Tous</option>
          <option value="vendu">Vendus</option>
          <option value="mort">Morts</option>
          <option value="reforme">Réformés</option>
        </select>
        <select value={f.categorie} onChange={(e) => set('categorie', e.currentTarget.value as Filtres['categorie'])} aria-label="Catégorie">
          <option value="">Catégories</option>
          {Object.entries(CATEGORIE_LABEL).map(([k, v]) => (
            <option value={k}>{v}</option>
          ))}
        </select>
        <select value={f.sexe} onChange={(e) => set('sexe', e.currentTarget.value as Filtres['sexe'])} aria-label="Sexe">
          <option value="">Sexes</option>
          <option value="F">Femelles</option>
          <option value="M">Mâles</option>
        </select>
        <button type="button" class={'filter-toggle' + (ouvert ? ' on' : '')} onClick={() => setOuvert(!ouvert)} aria-expanded={ouvert}>
          <SlidersHorizontal size={16} />
          Filtres{actifs.length > 0 && <span class="count">{actifs.length}</span>}
        </button>
      </div>

      {ouvert && (
        <section class="card filter-panel">
          <label>
            <span>Année de naissance</span>
            <select value={f.annee} onChange={(e) => set('annee', e.currentTarget.value)}>
              <option value="">Toutes</option>
              {anneesNaissance(data.animals).map((y) => <option value={y}>{y}</option>)}
            </select>
          </label>
          <label>
            <span>Tri</span>
            <select value={f.tri} onChange={(e) => set('tri', e.currentTarget.value as Tri)}>
              {Object.entries(TRI_LABEL).map(([k, v]) => <option value={k}>{v}</option>)}
            </select>
          </label>
          <label>
            <span>Né(e) à partir du</span>
            <input type="date" value={f.neDu} onInput={(e) => set('neDu', e.currentTarget.value)} />
          </label>
          <label>
            <span>Né(e) jusqu'au</span>
            <input type="date" value={f.neAu} onInput={(e) => set('neAu', e.currentTarget.value)} />
          </label>
          <label>
            <span>Mère</span>
            <select value={f.mereId} onChange={(e) => set('mereId', e.currentTarget.value)}>
              <option value="">Toutes</option>
              {meres(data.animals).map((o) => <option value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <label>
            <span>Père</span>
            <select value={f.pere} onChange={(e) => set('pere', e.currentTarget.value)}>
              <option value="">Tous</option>
              {peres(data.animals).map((o) => <option value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <label>
            <span>Reproduction</span>
            <select value={f.repro} onChange={(e) => set('repro', e.currentTarget.value as Filtres['repro'])}>
              <option value="">Indifférent</option>
              {Object.entries(ETAT_REPRO_LABEL).map(([k, v]) => <option value={k}>{v}</option>)}
            </select>
          </label>
          <label class="check">
            <input type="checkbox" checked={f.attente} onChange={(e) => set('attente', e.currentTarget.checked)} />
            <span>Délai d'attente en cours</span>
          </label>
          <div class="row full">
            <button type="button" class="small" onClick={reset}>Réinitialiser les filtres</button>
            <button type="button" class="small" onClick={exporter} disabled={!rows.length}><Download size={15} />Exporter la liste (CSV)</button>
          </div>
        </section>
      )}

      {actifs.length > 0 && (
        <div class="chips active-filters">
          {actifs.map((x) => (
            <button type="button" class="btn small" key={x.key} onClick={() => set(x.key, FILTRES_DEFAUT[x.key])} title="Retirer ce filtre">
              {x.label}
              <X size={14} />
            </button>
          ))}
        </div>
      )}

      <Card>
        {rows.length ? (
          <ul class="list">
            {rows.map(({ a, c, etat, velage, attente }) => (
              <li key={a.id}>
                <Tag a={a} />
                <a class="item" href={`#/animaux/${a.id}`}>
                  <b>{nameOf(a) || <span style="color:var(--ink-3)">Sans nom</span>}</b>
                  <small>
                    <Sex s={a.sexe} />
                    {CATEGORIE_LABEL[c]} · {formatAge(a.naissance, today) || 'âge inconnu'}
                    {etat === 'pleine' && velage ? ` · vêlage le ${formatDate(velage)}` : ''}
                  </small>
                </a>
                <span class="trail">
                  {attente && <Badge tone="warn">Délai</Badge>}
                  {f.repro === '' && etat === 'pleine' && <Badge>Pleine</Badge>}
                  {a.statut !== 'present' && <Badge tone={statutTone(a.statut)}>{STATUT_LABEL[a.statut]}</Badge>}
                  <ChevronRight size={18} class="chev" />
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>
            {data.animals.length ? (
              <>Aucun animal ne correspond. <a href="javascript:void 0" onClick={(e) => { e.preventDefault(); reset(); setQ('') }}>Effacer les filtres</a></>
            ) : (
              'Aucun animal pour le moment. Ajoutez le premier avec « Animal ».'
            )}
          </Empty>
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
  const chaleurs = data.chaleurs.filter((c) => c.vacheId === id).sort((x, y) => y.date.localeCompare(x.date))
  const prochaine = a && a.sexe === 'F' && a.statut === 'present' ? prochaineChaleur(id, data, today) : null
  const c = categorie(a, today, calved)
  const enAttente = soins.some((s) => withdrawalEnd(s.date, s.delaiJours) >= today)

  async function supprimer() {
    const p = planAnimal(data, a!)
    const n = linkedCount(p)
    const msg = n
      ? `Supprimer ${label(a)} et ses saisies (${linkedSummary(p)}) ?` + (enfants.length ? `\n\nSes ${enfants.length} descendant(s) sont conservés.` : '')
      : `Supprimer ${label(a)} ?`
    if (!confirm(msg + '\n\nVous pourrez annuler juste après.')) return
    await remove(p, () => go('/animaux'))
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
          {a.sexe === 'F' && <a class="btn small" href={`#/chaleurs/new?vache=${id}`}><Flame size={16} />Chaleurs</a>}
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

      {(chaleurs.length > 0 || prochaine) && (
        <Card title="Chaleurs" count={chaleurs.length}>
          {prochaine && (
            <p class="banner" style="margin-bottom:10px">
              <Flame size={18} />
              <span>{prochaine.type === 'retour' ? 'Retour en chaleur possible' : 'Prochaines chaleurs prévues'} le <b>{formatDate(prochaine.date)}</b></span>
            </p>
          )}
          <ul class="list">
            {chaleurs.map((c) => (
              <li key={c.id}>
                <DateChip iso={c.date} />
                <a class="item" href={`#/chaleurs/${c.id}`}>
                  <b>Chaleurs observées</b>
                  {c.notes && <small>{c.notes}</small>}
                </a>
                <DeleteBtn onDelete={() => remove(planSimple('chaleurs', c, 'Chaleurs'))} />
              </li>
            ))}
          </ul>
        </Card>
      )}

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
                <DeleteBtn onDelete={() => remove(planRepro(data, r))} />
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
                <DeleteBtn onDelete={() => remove(planVelage(data, v))} />
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
                  <DeleteBtn onDelete={() => remove(planSoinPourAnimal(s, id))} title={s.animalIds.length > 1 ? 'Retirer cet animal du soin' : 'Supprimer'} />
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
                <DeleteBtn onDelete={() => remove(planMouvement(data, m))} />
              </li>
            ))}
          </ul>
        </Card>
      )}

      <button class="danger small" onClick={supprimer}>Supprimer cet animal</button>
    </Page>
  )
}

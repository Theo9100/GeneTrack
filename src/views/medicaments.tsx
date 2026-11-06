import { useEffect, useMemo, useState } from 'preact/hooks'
import { ChevronRight, ExternalLink, Pill, Syringe, TriangleAlert } from 'lucide-preact'
import type { ComponentChildren } from 'preact'
import type { Data } from '../types'
import { Badge, Card, Empty, Page, SearchInput, go } from '../ui'
import {
  chargerMedicaments, chercher, delaiViandeJours, dosesParKg, formatDose, type BaseMedicaments, type Medicament,
} from '../medicaments'

function useBase() {
  const [base, setBase] = useState<BaseMedicaments>()
  const [err, setErr] = useState('')
  useEffect(() => {
    chargerMedicaments().then(setBase, (e) => setErr(e instanceof Error ? e.message : String(e)))
  }, [])
  return { base, err }
}

const fdate = (iso: string) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '')

function Avertissement({ base }: { base?: BaseMedicaments }) {
  return (
    <p class="banner" style="margin-bottom:14px">
      <TriangleAlert size={18} />
      <span>
        Textes officiels de l'ANMV{base?.date ? ` (base du ${fdate(base.date)})` : ''}, donnés à titre d'information.
        Suivez toujours l'ordonnance de votre vétérinaire.
      </span>
    </p>
  )
}

const viandeCourt = (m: Medicament) => {
  const j = delaiViandeJours(m)
  return j === null ? null : j === 0 ? 'Viande 0 j' : `Viande ${j} j`
}

export function ListeMedicaments({ data, q0 }: { data: Data; q0: string }) {
  const { base, err } = useBase()
  const [q, setQ] = useState(q0)
  const res = useMemo(() => (base ? chercher(base.items, q) : []), [base, q])
  // Produits déjà notés dans vos soins, retrouvés dans la base.
  const vos = useMemo(() => {
    if (!base) return []
    const noms = [...new Set(data.soins.map((s) => s.produit.trim()).filter(Boolean))]
    return noms.map((n) => chercher(base.items, n, 1)[0]).filter((m, i, a): m is Medicament => !!m && a.indexOf(m) === i).slice(0, 8)
  }, [base, data.soins])

  const ligne = (m: Medicament) => (
    <li key={m.id}>
      <span class="pill-ico"><Pill size={17} /></span>
      <a class="item" href={`#/medicaments/${m.id}`}>
        <b>{m.nom}</b>
        <small>{[m.substances.slice(0, 3).join(', '), m.forme].filter(Boolean).join(' · ')}</small>
      </a>
      <span class="trail">
        {viandeCourt(m) && <Badge tone="grey">{viandeCourt(m)}</Badge>}
        <ChevronRight size={18} class="chev" />
      </span>
    </li>
  )

  return (
    <Page title="Médicaments" sub={base ? `${base.items.length.toLocaleString('fr-FR')} médicaments autorisés pour les bovins` : 'Posologies et temps d’attente officiels'} back="/sante">
      <SearchInput value={q} onInput={setQ} placeholder="Nom du produit ou substance (ex. ivermectine)" />
      {err && <p class="banner bad">{err} Elle sera disponible après la prochaine mise à jour de l'app.</p>}
      {!base && !err && <Empty>Chargement de la base…</Empty>}
      {base && q.trim() && (
        <Card title="Résultats" count={res.length}>
          {res.length ? <ul class="list">{res.map(ligne)}</ul> : <Empty>Aucun médicament bovin ne correspond à « {q} ».</Empty>}
        </Card>
      )}
      {base && !q.trim() && (
        <>
          {vos.length > 0 && (
            <Card title="Produits de vos soins">
              <ul class="list">{vos.map(ligne)}</ul>
            </Card>
          )}
          <Card>
            <p style="margin:0">
              Tapez le nom d'un produit ou d'une substance active pour afficher sa <b>posologie</b>, ses <b>temps d'attente</b> viande et lait,
              et calculer la dose selon le poids.
            </p>
          </Card>
        </>
      )}
      <Avertissement base={base} />
    </Page>
  )
}

/** Met en évidence les mentions des bovins dans un texte de RCP. */
function Texte({ t }: { t: string }) {
  const parts = t.split(/(\b(?:bovins?|vaches?|veaux|veau|génisses?|taurillons?)\b)/gi)
  return <p class="rcp">{parts.map((p, i) => (i % 2 ? <mark key={i}>{p}</mark> : p))}</p>
}

function Section({ title, children }: { title: string; children: ComponentChildren }) {
  return <Card title={title}>{children}</Card>
}

function CalculDose({ m }: { m: Medicament }) {
  const [poids, setPoids] = useState('')
  const doses = useMemo(() => dosesParKg(m.posologie), [m])
  const p = Number(poids.replace(',', '.'))
  if (!doses.length) return null
  return (
    <Section title="Calcul de dose (indicatif)">
      <label>
        <span>Poids de l'animal (kg)</span>
        <input type="number" inputMode="decimal" placeholder="ex. 650" value={poids} onInput={(e) => setPoids(e.currentTarget.value)} />
      </label>
      <ul class="list" style="margin-top:8px">
        {doses.map((d, i) => (
          <li key={i} class={d.bovin ? '' : 'autre-espece'}>
            <span class="item wrap">
              <b>{p > 0 ? `${formatDose(d.quantite * p)}${d.max ? ` à ${formatDose(d.max * p)}` : ''} ${d.unite}` : '—'}</b>
              <small>
                « {d.texte} » · {formatDose(d.quantite)}{d.max ? ` à ${formatDose(d.max)}` : ''} {d.unite}/kg
              </small>
            </span>
            {d.espece && <Badge tone={d.bovin ? '' : 'grey'}>{d.espece}</Badge>}
          </li>
        ))}
      </ul>
      <p style="margin:10px 0 0">
        <small>Calcul automatique à partir du texte ci-dessus : vérifiez-le toujours (doses maximales, nombre d'injections, espèce concernée).</small>
      </p>
    </Section>
  )
}

export function FicheMedicament({ id }: { id: string }) {
  const { base, err } = useBase()
  const m = base?.items.find((x) => x.id === id)
  if (err) return <Page title="Médicament" back="/medicaments"><p class="banner bad">{err}</p></Page>
  if (!base) return <Page title="Médicament" back="/medicaments"><Empty>Chargement…</Empty></Page>
  if (!m) return <Page title="Médicament introuvable" back="/medicaments"><Empty>Ce médicament n'est plus dans la base.</Empty></Page>
  const delai = delaiViandeJours(m)
  const soin = `/sante/new?produit=${encodeURIComponent(m.nom)}${delai !== null ? `&delai=${delai}` : ''}`

  return (
    <Page title={m.nom} head={<h1 class="wrap">{m.nom}</h1>} back="/medicaments" sub={[m.forme, m.titulaire].filter(Boolean).join(' · ')}>
      <div class="chips">
        <a class="btn small primary" href={'#' + soin}><Syringe size={16} />Utiliser pour un soin</a>
        {m.lien && <a class="btn small" href={m.lien} target="_blank" rel="noopener"><ExternalLink size={15} />RCP officiel complet</a>}
      </div>

      <Section title="Posologie et voie d'administration">
        {m.posologie ? <Texte t={m.posologie} /> : <Empty>Non renseignée dans la base : consultez le RCP officiel.</Empty>}
      </Section>

      <CalculDose m={m} />

      <Section title="Temps d'attente">
        {m.attente.length > 0 && (
          <ul class="list">
            {m.attente.map((t, i) => (
              <li key={i}>
                <span class="item wrap">
                  <b>{t.denree}</b>
                  <small>{t.valeur}{t.voie ? ` · voie ${t.voie.toLowerCase()}` : ''}</small>
                </span>
                {/^zéro/i.test(t.valeur) ? <Badge>0 j</Badge> : null}
              </li>
            ))}
          </ul>
        )}
        {m.attenteTexte && <Texte t={m.attenteTexte} />}
        {!m.attente.length && !m.attenteTexte && <Empty>Non renseigné : consultez le RCP officiel.</Empty>}
      </Section>

      {m.indications && <Section title="Indications"><Texte t={m.indications} /></Section>}
      {m.contreIndications && <Section title="Contre-indications"><Texte t={m.contreIndications} /></Section>}

      <Card title="Informations">
        <dl class="facts">
          <div><dt>Substances actives</dt><dd>{m.substances.join(', ') || '—'}</dd></div>
          <div><dt>Voies (bovins)</dt><dd>{m.voies.join(', ') || '—'}</dd></div>
          <div><dt>N° d'AMM</dt><dd>{m.amm || '—'}</dd></div>
          <div><dt>RCP mis à jour le</dt><dd>{fdate(m.maj) || '—'}</dd></div>
        </dl>
      </Card>
      <Avertissement base={base} />
      <button class="small" onClick={() => go('/medicaments')}>Nouvelle recherche</button>
    </Page>
  )
}

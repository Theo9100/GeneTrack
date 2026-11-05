import { useEffect, useMemo, useState } from 'preact/hooks'
import type { ComponentChildren } from 'preact'
import { liveQuery } from 'dexie'
import { loadAll } from './db'
import { ChevronLeft, Search, Trash2 } from 'lucide-preact'
import { applyPlan, type Plan } from './remove'
import type { Animal, Data } from './types'
import { label, shortId } from './logic'

// ---------- Routage par hash ----------
export const go = (path: string) => {
  location.hash = path
}
export function useRoute() {
  const read = () => location.hash.slice(1) || '/'
  const [h, setH] = useState(read)
  useEffect(() => {
    const f = () => setH(read())
    addEventListener('hashchange', f)
    return () => removeEventListener('hashchange', f)
  }, [])
  const [path, qs = ''] = h.split('?')
  return { parts: path.split('/').filter(Boolean), q: new URLSearchParams(qs) }
}

// ---------- Données en direct ----------
export function useData(): Data | undefined {
  const [d, setD] = useState<Data>()
  useEffect(() => {
    const s = liveQuery(loadAll).subscribe({ next: setD, error: (e) => console.error(e) })
    return () => s.unsubscribe()
  }, [])
  return d
}

// ---------- Mise en page ----------
export function Page({ title, sub, back, actions, head, children }: {
  title: string
  sub?: ComponentChildren
  back?: string
  actions?: ComponentChildren
  head?: ComponentChildren
  children: ComponentChildren
}) {
  return (
    <main>
      <header class="top">
        {back && (
          <a class="btn icon-btn back" href={'#' + back} aria-label="Retour">
            <ChevronLeft size={20} />
          </a>
        )}
        <div class="titles">
          {head ?? <h1>{title}</h1>}
          {sub && <div class="sub">{sub}</div>}
        </div>
        <div class="actions">{actions}</div>
      </header>
      {children}
    </main>
  )
}
export const Card = ({ title, count, children }: { title?: string; count?: number; children: ComponentChildren }) => (
  <section class="card">
    {title && (
      <h2>
        {title}
        {count !== undefined && count > 0 && <span class="count">{count}</span>}
      </h2>
    )}
    {children}
  </section>
)
export const Empty = ({ children }: { children: ComponentChildren }) => <p class="empty">{children}</p>
export const Badge = ({ children, tone = '' }: { children: ComponentChildren; tone?: string }) => <span class={'badge ' + tone}>{children}</span>

/** N° de travail affiché comme une boucle d'oreille. */
export const Tag = ({ a, size = '' }: { a: Animal | undefined; size?: '' | 'sm' | 'lg' }) => (
  <span class={'tag ' + size}>{a ? shortId(a) : '?'}</span>
)
export const Sex = ({ s }: { s: 'F' | 'M' }) => <span class={'sex ' + s} title={s === 'F' ? 'Femelle' : 'Mâle'} />

const MOIS = ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc']
export function DateChip({ iso, tone = '' }: { iso: string; tone?: '' | 'late' | 'soon' }) {
  const [y, m, d] = iso.split('-').map(Number)
  const thisYear = new Date().getFullYear()
  return (
    <span class={'date ' + tone} title={iso}>
      <b>{d}</b>
      <span>{MOIS[m - 1]}{y !== thisYear ? ` ${String(y).slice(2)}` : ''}</span>
    </span>
  )
}

/** Nom à afficher à côté de la boucle. */
export const nameOf = (a: Animal | undefined) => (a ? a.nom || (a.travail && a.numero ? '…' + a.numero.slice(-4) : a.numero) || '' : 'Inconnu')

export function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function SearchInput({ value, onInput, placeholder }: { value: string; onInput: (v: string) => void; placeholder: string }) {
  return (
    <div class="search">
      <Search size={17} />
      <input type="search" placeholder={placeholder} value={value} onInput={(e) => onInput(e.currentTarget.value)} />
    </div>
  )
}

// ---------- Suppression avec annulation ----------
type ToastState = { msg: string; undo?: () => Promise<void>; id: number } | null
let toastState: ToastState = null
const toastSubs = new Set<() => void>()
export function toast(msg: string, undo?: () => Promise<void>) {
  toastState = { msg, undo, id: Date.now() + Math.random() }
  toastSubs.forEach((f) => f())
}

/** Bandeau en bas d'écran : message + bouton « Annuler » pendant 8 secondes. */
export function Toaster() {
  const [t, setT] = useState<ToastState>(toastState)
  useEffect(() => {
    const f = () => setT(toastState)
    toastSubs.add(f)
    return () => void toastSubs.delete(f)
  }, [])
  useEffect(() => {
    if (!t) return
    const h = setTimeout(() => {
      if (toastState?.id === t.id) {
        toastState = null
        setT(null)
      }
    }, t.undo ? 8000 : 3000)
    return () => clearTimeout(h)
  }, [t?.id])
  if (!t) return null
  return (
    <div class="toast" role="status" key={t.id}>
      <span>{t.msg}</span>
      {t.undo && (
        <button
          type="button"
          onClick={async () => {
            const undo = t.undo!
            toastState = null
            setT(null)
            await undo()
            toast('Suppression annulée')
          }}
        >
          Annuler
        </button>
      )}
    </div>
  )
}

/** Applique un plan de suppression et propose l'annulation. */
export async function remove(plan: Plan, then?: () => void) {
  const undo = await applyPlan(plan)
  toast(plan.label, undo)
  then?.()
}

/** Petit bouton corbeille pour les lignes de liste. */
export function DeleteBtn({ onDelete, title = 'Supprimer' }: { onDelete: () => void; title?: string }) {
  return (
    <button
      type="button"
      class="icon-btn del"
      aria-label={title}
      title={title}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onDelete()
      }}
    >
      <Trash2 size={16} />
    </button>
  )
}

// ---------- Formulaires ----------
export interface FieldDef {
  name: string
  label: string
  type?: 'text' | 'email' | 'date' | 'number' | 'select' | 'textarea' | 'checkbox' | 'password'
  options?: { value: string; label: string }[]
  required?: boolean
  hint?: string
  placeholder?: string
  show?: (v: Values) => boolean
}
export type Values = Record<string, string | boolean>

export function Form({ fields, initial, submitLabel = 'Enregistrer', onSubmit, onChange, children }: {
  fields: FieldDef[]
  initial: Values
  submitLabel?: string
  onSubmit: (v: Values) => void | Promise<void>
  onChange?: (v: Values) => void
  children?: ComponentChildren
}) {
  const [v, setV] = useState<Values>(initial)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (name: string, val: string | boolean) => {
    const nv = { ...v, [name]: val }
    setV(nv)
    onChange?.(nv)
  }
  useEffect(() => onChange?.(v), [])
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault()
        setErr('')
        setBusy(true)
        try {
          await onSubmit(v)
        } catch (x) {
          setErr(x instanceof Error ? x.message : String(x))
        } finally {
          setBusy(false)
        }
      }}
    >
      {fields.filter((f) => !f.show || f.show(v)).map((f) => (
        <label key={f.name} class={f.type === 'checkbox' ? 'check' : ''}>
          <span>
            {f.label}
            {f.required && ' *'}
          </span>
          {f.type === 'select' ? (
            <select value={v[f.name] as string} required={f.required} onChange={(e) => set(f.name, e.currentTarget.value)}>
              {f.options!.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : f.type === 'textarea' ? (
            <textarea rows={3} value={v[f.name] as string} onInput={(e) => set(f.name, e.currentTarget.value)} />
          ) : f.type === 'checkbox' ? (
            <input type="checkbox" checked={!!v[f.name]} onChange={(e) => set(f.name, e.currentTarget.checked)} />
          ) : (
            <input
              type={(f.type ?? 'text') as any}
              inputMode={f.type === 'number' ? 'decimal' : undefined}
              step={f.type === 'number' ? 'any' : undefined}
              value={v[f.name] as string}
              required={f.required}
              placeholder={f.placeholder}
              autoComplete="off"
              onInput={(e) => set(f.name, e.currentTarget.value)}
            />
          )}
          {f.hint && <small>{f.hint}</small>}
        </label>
      ))}
      {children}
      {err && <p class="error">{err}</p>}
      <button class="primary" disabled={busy}>
        {submitLabel}
      </button>
    </form>
  )
}

export const animalOptions = (animals: Animal[], blank?: string) => [
  ...(blank !== undefined ? [{ value: '', label: blank }] : []),
  ...[...animals].sort((a, b) => label(a).localeCompare(label(b), 'fr', { numeric: true })).map((a) => ({ value: a.id, label: label(a) })),
]

/** Sélection multiple d'animaux avec recherche. */
export function AnimalPicker({ animals, selected, onChange }: { animals: Animal[]; selected: string[]; onChange: (ids: string[]) => void }) {
  const [q, setQ] = useState('')
  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    return [...animals]
      .filter((a) => !s || (a.numero + ' ' + a.travail + ' ' + a.nom).toLowerCase().includes(s))
      .sort((a, b) => label(a).localeCompare(label(b), 'fr', { numeric: true }))
  }, [animals, q])
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])
  return (
    <div class="picker">
      <div class="picker-bar">
        <input type="search" placeholder="Rechercher…" value={q} onInput={(e) => setQ(e.currentTarget.value)} />
        <button type="button" onClick={() => onChange([...new Set([...selected, ...list.map((a) => a.id)])])}>
          Tout
        </button>
        <button type="button" onClick={() => onChange([])}>
          Aucun
        </button>
      </div>
      <div class="picker-list">
        {list.map((a) => (
          <label key={a.id} class="check">
            <input type="checkbox" checked={selected.includes(a.id)} onChange={() => toggle(a.id)} />
            <Tag a={a} size="sm" />
            <span>{a.nom}</span>
          </label>
        ))}
        {!list.length && <Empty>Aucun animal.</Empty>}
      </div>
      <small>{selected.length} sélectionné(s)</small>
    </div>
  )
}

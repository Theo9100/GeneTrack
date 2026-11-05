import { useEffect, useMemo, useState } from 'preact/hooks'
import type { ComponentChildren } from 'preact'
import { liveQuery } from 'dexie'
import { loadAll } from './db'
import type { Animal, Data } from './types'
import { label } from './logic'

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
export function Page({ title, back, actions, children }: { title: string; back?: string; actions?: ComponentChildren; children: ComponentChildren }) {
  return (
    <main>
      <header class="top">
        {back && (
          <a class="back" href={'#' + back} aria-label="Retour">
            ‹
          </a>
        )}
        <h1>{title}</h1>
        <div class="actions">{actions}</div>
      </header>
      {children}
    </main>
  )
}
export const Card = ({ title, children }: { title?: string; children: ComponentChildren }) => (
  <section class="card">
    {title && <h2>{title}</h2>}
    {children}
  </section>
)
export const Empty = ({ children }: { children: ComponentChildren }) => <p class="empty">{children}</p>
export const Badge = ({ children, tone = '' }: { children: ComponentChildren; tone?: string }) => <span class={'badge ' + tone}>{children}</span>

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

// ---------- Formulaires ----------
export interface FieldDef {
  name: string
  label: string
  type?: 'text' | 'date' | 'number' | 'select' | 'textarea' | 'checkbox' | 'password'
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
            <span>{label(a)}</span>
          </label>
        ))}
        {!list.length && <Empty>Aucun animal.</Empty>}
      </div>
      <small>{selected.length} sélectionné(s)</small>
    </div>
  )
}

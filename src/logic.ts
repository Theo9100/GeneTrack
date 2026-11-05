import type { Animal, Data, Repro, Velage } from './types'

// ---------- Dates (chaînes YYYY-MM-DD, calcul en UTC pour éviter les décalages d'heure d'été) ----------
const pad = (n: number) => String(n).padStart(2, '0')

export function isoToday(d = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
const toUTC = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}
export function addDays(iso: string, n: number): string {
  return new Date(toUTC(iso) + n * 864e5).toISOString().slice(0, 10)
}
/** nombre de jours de a vers b (positif si b est après a) */
export function diffDays(a: string, b: string): number {
  return Math.round((toUTC(b) - toUTC(a)) / 864e5)
}
export function ageMonths(naissance: string, today: string): number | null {
  if (!naissance) return null
  const [y1, m1, d1] = naissance.split('-').map(Number)
  const [y2, m2, d2] = today.split('-').map(Number)
  return (y2 - y1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0)
}
export function formatDate(iso: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}
export function formatAge(naissance: string, today = isoToday()): string {
  const m = ageMonths(naissance, today)
  if (m === null) return ''
  if (m < 1) return `${Math.max(0, diffDays(naissance, today))} j`
  if (m < 24) return `${m} mois`
  const y = Math.floor(m / 12)
  return `${y} an${y > 1 ? 's' : ''}${m % 12 ? ` ${m % 12} m` : ''}`
}

// ---------- Animaux ----------
export function shortId(a: Animal): string {
  return a.travail || a.numero.slice(-4)
}
export function label(a: Animal | undefined): string {
  if (!a) return '(inconnu)'
  return `${shortId(a)}${a.nom ? ' · ' + a.nom : ''}`
}
export const normNumero = (s: string) => s.replace(/\s+/g, '').toUpperCase()

export type Categorie = 'veau' | 'genisse' | 'vache' | 'taureau'
export const CATEGORIE_LABEL: Record<Categorie, string> = {
  veau: 'Veau / velle',
  genisse: 'Génisse',
  vache: 'Vache',
  taureau: 'Taureau',
}

/** Ensemble des mères ayant déjà vêlé (vêlage enregistré ou descendant présent). */
export function calvedSet(animals: Animal[], velages: Velage[]): Set<string> {
  const s = new Set<string>()
  velages.forEach((v) => s.add(v.mereId))
  animals.forEach((a) => a.mereId && s.add(a.mereId))
  return s
}

export function categorie(a: Animal, today: string, calved: Set<string>): Categorie {
  const m = ageMonths(a.naissance, today)
  if (a.sexe === 'M') return m !== null && m < 12 ? 'veau' : 'taureau'
  if (calved.has(a.id)) return 'vache'
  if (m === null) return 'genisse'
  if (m < 12) return 'veau'
  return m >= 36 ? 'vache' : 'genisse'
}

// ---------- Généalogie ----------
/** Ancêtres d'un animal avec leur génération (1 = parent). */
export function ancestors(map: Map<string, Animal>, id: string, depth: number): Map<string, number> {
  const out = new Map<string, number>()
  const walk = (cur: string, gen: number) => {
    const a = map.get(cur)
    if (!a || gen > depth) return
    for (const p of [a.mereId, a.pereId]) {
      if (!p) continue
      if (!out.has(p) || out.get(p)! > gen) out.set(p, gen)
      walk(p, gen + 1)
    }
  }
  walk(id, 1)
  return out
}

/** Ancêtres communs de deux reproducteurs (eux-mêmes inclus) : alerte de consanguinité. */
export function commonAncestors(animals: Animal[], a: string, b: string, depth = 4): string[] {
  if (!a || !b) return []
  const map = new Map(animals.map((x) => [x.id, x]))
  const sa = ancestors(map, a, depth)
  const sb = ancestors(map, b, depth)
  sa.set(a, 0)
  sb.set(b, 0)
  return [...sa.keys()].filter((k) => sb.has(k))
}

// ---------- Reproduction ----------
export const dueDate = (r: Pick<Repro, 'date'>, gest: number) => addDays(r.date, gest)

// ---------- Santé ----------
export const withdrawalEnd = (date: string, delaiJours: number) =>
  delaiJours > 0 ? addDays(date, delaiJours) : ''

// ---------- Alertes / agenda ----------
export type AlerteKind = 'velage' | 'diag' | 'rappel' | 'attente'
export interface Alerte {
  uid: string
  kind: AlerteKind
  date: string
  titre: string
  detail: string
  animalIds: string[]
  lien: string
  retard: boolean
}

export function agenda(
  data: Pick<Data, 'animals' | 'repros' | 'soins' | 'gest'>,
  today: string,
  horizon: { velage: number; autre: number } = { velage: 90, autre: 30 },
): Alerte[] {
  const byId = new Map(data.animals.map((a) => [a.id, a]))
  const present = (id: string) => byId.get(id)?.statut === 'present'
  const out: Alerte[] = []

  for (const r of data.repros) {
    if (r.velageId || !present(r.vacheId)) continue
    const nom = label(byId.get(r.vacheId))
    if (r.diagResultat !== 'vide') {
      const due = dueDate(r, data.gest)
      if (diffDays(today, due) <= horizon.velage && diffDays(due, today) <= 30) {
        out.push({
          uid: `velage-${r.id}`,
          kind: 'velage',
          date: due,
          titre: `Vêlage prévu : ${nom}`,
          detail: r.diagResultat === 'pleine' ? 'Gestation confirmée' : 'Gestation non confirmée',
          animalIds: [r.vacheId],
          lien: `/repro/${r.id}`,
          retard: due < today,
        })
      }
    }
    if (!r.diagResultat) {
      const d = addDays(r.date, 60)
      if (diffDays(today, d) <= horizon.autre && diffDays(r.date, today) <= 150) {
        out.push({
          uid: `diag-${r.id}`,
          kind: 'diag',
          date: d,
          titre: `Diagnostic de gestation : ${nom}`,
          detail: `Saillie/IA du ${formatDate(r.date)}`,
          animalIds: [r.vacheId],
          lien: `/repro/${r.id}`,
          retard: d < today,
        })
      }
    }
  }

  for (const s of data.soins) {
    const noms = s.animalIds.map((i) => label(byId.get(i)))
    const resume = noms.length > 3 ? `${noms.slice(0, 3).join(', ')} +${noms.length - 3}` : noms.join(', ')
    if (s.rappelDate && !s.rappelFait && diffDays(today, s.rappelDate) <= horizon.autre) {
      out.push({
        uid: `rappel-${s.id}`,
        kind: 'rappel',
        date: s.rappelDate,
        titre: `Rappel ${s.type}${s.produit ? ' (' + s.produit + ')' : ''}`,
        detail: resume,
        animalIds: s.animalIds,
        lien: `/sante/${s.id}`,
        retard: s.rappelDate < today,
      })
    }
    const fin = withdrawalEnd(s.date, s.delaiJours)
    const concernes = s.animalIds.filter(present)
    if (fin && fin >= today && concernes.length && diffDays(today, fin) <= horizon.autre + 60) {
      out.push({
        uid: `attente-${s.id}`,
        kind: 'attente',
        date: fin,
        titre: `Fin de délai d'attente${s.produit ? ' : ' + s.produit : ''}`,
        detail: resume,
        animalIds: concernes,
        lien: `/sante/${s.id}`,
        retard: false,
      })
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date))
}

// ---------- Export calendrier (.ics) ----------
const icsEsc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
const icsDate = (iso: string) => iso.replace(/-/g, '')

export function buildIcs(events: Alerte[], now = new Date()): string {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//GeneTrack//FR', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:GeneTrack']
  for (const e of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.uid}@genetrack`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${icsDate(e.date)}`,
      `DTEND;VALUE=DATE:${icsDate(addDays(e.date, 1))}`,
      `SUMMARY:${icsEsc(e.titre)}`,
      `DESCRIPTION:${icsEsc(e.detail)}`,
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${icsEsc(e.titre)}`,
      `TRIGGER:-P${e.kind === 'velage' ? 7 : 2}D`,
      'END:VALARM',
      'END:VEVENT',
    )
  }
  lines.push('END:VCALENDAR')
  return lines.join('\r\n') + '\r\n'
}

// ---------- CSV (séparateur ; pour Excel français) ----------
export function toCSV(rows: Record<string, unknown>[], cols: string[]): string {
  const cell = (v: unknown) => {
    const s = v === null || v === undefined ? '' : Array.isArray(v) ? v.join(' ') : String(v)
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return '\ufeff' + [cols.join(';'), ...rows.map((r) => cols.map((c) => cell(r[c])).join(';'))].join('\r\n')
}

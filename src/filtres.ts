import type { Animal, Data, Sexe, Statut } from './types'
import { calvedSet, categorie, dueDate, label, shortId, withdrawalEnd, type Categorie } from './logic'

/** État de reproduction d'une femelle en âge de reproduire. */
export type EtatRepro = 'pleine' | 'a-diagnostiquer' | 'vide' | 'non-saillie'
export const ETAT_REPRO_LABEL: Record<EtatRepro, string> = {
  pleine: 'Pleine',
  'a-diagnostiquer': 'Saillie à confirmer',
  vide: 'Vide',
  'non-saillie': 'Pas encore saillie',
}

export type Tri = 'travail' | 'nom' | 'jeunes' | 'vieux' | 'velage'
export const TRI_LABEL: Record<Tri, string> = {
  travail: 'N° de travail',
  nom: 'Nom',
  jeunes: 'Plus jeunes d’abord',
  vieux: 'Plus âgés d’abord',
  velage: 'Prochain vêlage',
}

export interface Filtres {
  statut: '' | Statut
  categorie: '' | Categorie
  sexe: '' | Sexe
  annee: string // année de naissance
  neDu: string // né(e) à partir du
  neAu: string // né(e) jusqu'au
  mereId: string
  pere: string // id d'un taureau du troupeau, ou « ext:<nom> » pour un père extérieur
  repro: '' | EtatRepro
  attente: boolean // délai d'attente en cours
  tri: Tri
}

export const FILTRES_DEFAUT: Filtres = {
  statut: 'present', categorie: '', sexe: '', annee: '', neDu: '', neAu: '', mereId: '', pere: '', repro: '', attente: false, tri: 'travail',
}

/** Calcule l'état de reproduction (null pour les mâles et les veaux). */
export function etatRepro(a: Animal, data: Pick<Data, 'repros' | 'velages'>, cat: Categorie): EtatRepro | null {
  if (a.sexe !== 'F' || cat === 'veau') return null
  const lastVel = data.velages.filter((v) => v.mereId === a.id).map((v) => v.date).sort().pop() ?? ''
  const r = data.repros.filter((x) => x.vacheId === a.id && !x.velageId && x.date > lastVel).sort((x, y) => x.date.localeCompare(y.date)).pop()
  if (!r) return 'non-saillie'
  return r.diagResultat === 'pleine' ? 'pleine' : r.diagResultat === 'vide' ? 'vide' : 'a-diagnostiquer'
}

export interface Ligne {
  a: Animal
  c: Categorie
  etat: EtatRepro | null
  velage: string // date de vêlage prévue (si gestante)
  attente: string // fin du délai d'attente en cours
}

export function lignes(data: Data, today: string): Ligne[] {
  const calved = calvedSet(data.animals, data.velages)
  const finAttente = new Map<string, string>()
  for (const s of data.soins) {
    const fin = withdrawalEnd(s.date, s.delaiJours)
    if (fin && fin >= today) for (const id of s.animalIds) if (fin > (finAttente.get(id) ?? '')) finAttente.set(id, fin)
  }
  return data.animals.map((a) => {
    const c = categorie(a, today, calved)
    const etat = etatRepro(a, data, c)
    let velage = ''
    if (etat === 'pleine' || etat === 'a-diagnostiquer') {
      const r = data.repros.filter((x) => x.vacheId === a.id && !x.velageId).sort((x, y) => x.date.localeCompare(y.date)).pop()
      if (r) velage = dueDate(r, data.gest)
    }
    return { a, c, etat, velage, attente: finAttente.get(a.id) ?? '' }
  })
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '')

export function filtrer(all: Ligne[], f: Filtres, q: string): Ligne[] {
  const s = norm(q)
  const out = all.filter(({ a, c, etat, attente }) => {
    if (f.statut && a.statut !== f.statut) return false
    if (f.categorie && c !== f.categorie) return false
    if (f.sexe && a.sexe !== f.sexe) return false
    if (f.annee && a.naissance.slice(0, 4) !== f.annee) return false
    if ((f.neDu || f.neAu) && !a.naissance) return false
    if (f.neDu && a.naissance < f.neDu) return false
    if (f.neAu && a.naissance > f.neAu) return false
    if (f.mereId && a.mereId !== f.mereId) return false
    if (f.pere) {
      if (f.pere.startsWith('ext:') ? a.pereId || a.pereTexte !== f.pere.slice(4) : a.pereId !== f.pere) return false
    }
    if (f.repro && etat !== f.repro) return false
    if (f.attente && !attente) return false
    if (s && !norm(a.numero + a.travail + a.nom).includes(s)) return false
    return true
  })
  const cmp: Record<Tri, (x: Ligne, y: Ligne) => number> = {
    travail: (x, y) => shortId(x.a).localeCompare(shortId(y.a), 'fr', { numeric: true }),
    nom: (x, y) => (x.a.nom || '￿').localeCompare(y.a.nom || '￿', 'fr') || cmp.travail(x, y),
    // âge inconnu toujours en fin de liste
    jeunes: (x, y) => (y.a.naissance || '0').localeCompare(x.a.naissance || '0') || cmp.travail(x, y),
    vieux: (x, y) => (x.a.naissance || '9').localeCompare(y.a.naissance || '9') || cmp.travail(x, y),
    velage: (x, y) => (x.velage || '9').localeCompare(y.velage || '9') || cmp.travail(x, y),
  }
  return out.sort(cmp[f.tri] ?? cmp.travail)
}

/** Années de naissance présentes dans le troupeau (les plus récentes d'abord). */
export const anneesNaissance = (animals: Animal[]) =>
  [...new Set(animals.map((a) => a.naissance.slice(0, 4)).filter(Boolean))].sort().reverse()

/** Pères possibles : taureaux du troupeau ayant des produits, puis pères extérieurs (IA…). */
export function peres(animals: Animal[]): { value: string; label: string }[] {
  const ids = new Set(animals.map((a) => a.pereId).filter(Boolean))
  const ext = new Set(animals.filter((a) => !a.pereId && a.pereTexte).map((a) => a.pereTexte))
  return [
    ...animals.filter((a) => ids.has(a.id)).map((a) => ({ value: a.id, label: label(a) })),
    ...[...ext].sort().map((t) => ({ value: 'ext:' + t, label: `${t} (extérieur)` })),
  ]
}
export const meres = (animals: Animal[]) => {
  const ids = new Set(animals.map((a) => a.mereId).filter(Boolean))
  return animals.filter((a) => ids.has(a.id)).map((a) => ({ value: a.id, label: label(a) }))
}

/** Résumé des filtres avancés actifs, pour les pastilles « × ». */
export function filtresActifs(f: Filtres, animals: Animal[]): { key: keyof Filtres; label: string }[] {
  const byId = new Map(animals.map((a) => [a.id, a]))
  const fd = (iso: string) => iso.split('-').reverse().join('/')
  const out: { key: keyof Filtres; label: string }[] = []
  if (f.annee) out.push({ key: 'annee', label: `Né(e)s en ${f.annee}` })
  if (f.neDu) out.push({ key: 'neDu', label: `Né(e)s depuis le ${fd(f.neDu)}` })
  if (f.neAu) out.push({ key: 'neAu', label: `Né(e)s jusqu'au ${fd(f.neAu)}` })
  if (f.mereId) out.push({ key: 'mereId', label: `Mère : ${label(byId.get(f.mereId))}` })
  if (f.pere) out.push({ key: 'pere', label: `Père : ${f.pere.startsWith('ext:') ? f.pere.slice(4) : label(byId.get(f.pere))}` })
  if (f.repro) out.push({ key: 'repro', label: ETAT_REPRO_LABEL[f.repro] })
  if (f.attente) out.push({ key: 'attente', label: "Délai d'attente en cours" })
  if (f.tri !== 'travail') out.push({ key: 'tri', label: `Tri : ${TRI_LABEL[f.tri]}` })
  return out
}

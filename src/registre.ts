import type { Data, TypeSoin } from './types'
import { withdrawalEnd } from './logic'

export interface Exploitation {
  nom: string
  cheptel: string // n° de cheptel (EDE)
  detenteur: string
  adresse: string
}
export const EXPLOITATION_VIDE: Exploitation = { nom: '', cheptel: '', detenteur: '', adresse: '' }

export interface LigneRegistre {
  id: string
  date: string
  animaux: { numero: string; travail: string; nom: string }[]
  type: TypeSoin
  produit: string
  dose: string
  delaiJours: number
  finAttente: string
  veterinaire: string
  ordonnance: string
  notes: string
}

/** Traitements de la période [du, au], dans l'ordre chronologique (animaux vendus ou morts compris). */
export function lignesRegistre(data: Pick<Data, 'soins' | 'animals'>, du: string, au: string): LigneRegistre[] {
  const byId = new Map(data.animals.map((a) => [a.id, a]))
  return data.soins
    .filter((s) => (!du || s.date >= du) && (!au || s.date <= au))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((s) => ({
      id: s.id,
      date: s.date,
      animaux: s.animalIds
        .map((id) => byId.get(id))
        .map((a) => (a ? { numero: a.numero, travail: a.travail, nom: a.nom } : { numero: '(animal supprimé)', travail: '', nom: '' })),
      type: s.type,
      produit: s.produit,
      dose: s.dose,
      delaiJours: s.delaiJours,
      finAttente: withdrawalEnd(s.date, s.delaiJours),
      veterinaire: s.veterinaire ?? '',
      ordonnance: s.ordonnance ?? '',
      notes: s.notes,
    }))
}

/** Périodes proposées. */
export function periodes(today: string): { label: string; du: string; au: string }[] {
  const y = Number(today.slice(0, 4))
  const ilYa = (mois: number) => {
    const d = new Date(Date.parse(today))
    d.setMonth(d.getMonth() - mois)
    return d.toISOString().slice(0, 10)
  }
  return [
    { label: `Année ${y}`, du: `${y}-01-01`, au: today },
    { label: '12 derniers mois', du: ilYa(12), au: today },
    { label: `Année ${y - 1}`, du: `${y - 1}-01-01`, au: `${y - 1}-12-31` },
    { label: '5 dernières années', du: ilYa(60), au: today },
  ]
}

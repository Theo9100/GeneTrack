import type { Animal, Data } from './types'
import { ageMonths, calvedSet, categorie, diffDays, formatDate } from './logic'
import { etatRepro } from './filtres'

/** Bilan de reproduction d'une campagne (année civile des vêlages). */
export interface Bilan {
  annee: string
  velages: number
  vivants: number
  mortNes: number
  males: number
  femelles: number
  difficiles: number // facilité 3 ou 4
  cesariennes: number // facilité 4
  poidsMoyen: number | null
  ivvMoyen: number | null // intervalle vêlage-vêlage moyen (jours)
  ivvN: number
  ivvLongs: number // > 400 jours
  agePremierVelage: number | null // mois
  primipares: number
  parMois: number[] // 12 valeurs, janvier → décembre
  saillies: number // saillies/IA de l'année
  diagnostiquees: number // dont le résultat est connu (diagnostic ou vêlage)
  pleines: number
  tauxGestation: number | null // %
}

export const IVV_LONG = 400
/** Au-delà, le « premier vêlage » enregistré n'est probablement pas le vrai premier (historique incomplet). */
const AGE_MAX_PRIMIPARE = 48

export function anneesBilan(data: Pick<Data, 'velages' | 'repros'>, today: string): string[] {
  const ys = new Set([today.slice(0, 4), ...data.velages.map((v) => v.date.slice(0, 4)), ...data.repros.map((r) => r.date.slice(0, 4))])
  return [...ys].filter(Boolean).sort().reverse()
}

const moyenne = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)

export function bilan(data: Data, annee: string): Bilan {
  const byId = new Map(data.animals.map((a) => [a.id, a]))
  const vels = data.velages.filter((v) => v.date.startsWith(annee))
  const parMois = Array(12).fill(0) as number[]
  vels.forEach((v) => parMois[Number(v.date.slice(5, 7)) - 1]++)

  // IVV : écart avec le vêlage précédent de la même mère
  const ivv: number[] = []
  // Âge au premier vêlage (mères dont c'est le premier vêlage enregistré)
  const ages: number[] = []
  for (const v of vels) {
    const avant = data.velages.filter((x) => x.mereId === v.mereId && x.date < v.date).map((x) => x.date).sort()
    if (avant.length) ivv.push(diffDays(avant[avant.length - 1], v.date))
    else {
      const mere = byId.get(v.mereId)
      const age = mere?.naissance ? ageMonths(mere.naissance, v.date) : null
      if (age !== null && age >= 18 && age <= AGE_MAX_PRIMIPARE) ages.push(age)
    }
  }

  const repros = data.repros.filter((r) => r.date.startsWith(annee))
  const pleines = repros.filter((r) => r.velageId || r.diagResultat === 'pleine').length
  const diagnostiquees = repros.filter((r) => r.velageId || r.diagResultat).length
  const poids = vels.filter((v) => !v.morNe && v.poids).map((v) => v.poids!) as number[]

  return {
    annee,
    velages: vels.length,
    vivants: vels.filter((v) => !v.morNe).length,
    mortNes: vels.filter((v) => v.morNe).length,
    males: vels.filter((v) => v.sexe === 'M').length,
    femelles: vels.filter((v) => v.sexe === 'F').length,
    difficiles: vels.filter((v) => v.facilite >= 3).length,
    cesariennes: vels.filter((v) => v.facilite >= 4).length,
    poidsMoyen: moyenne(poids),
    ivvMoyen: moyenne(ivv),
    ivvN: ivv.length,
    ivvLongs: ivv.filter((d) => d > IVV_LONG).length,
    agePremierVelage: moyenne(ages),
    primipares: ages.length,
    parMois,
    saillies: repros.length,
    diagnostiquees,
    pleines,
    tauxGestation: diagnostiquees ? (100 * pleines) / diagnostiquees : null,
  }
}

/** Vaches présentes à surveiller (candidates à la réforme), avec les raisons. */
export function aSurveiller(data: Data, today: string): { a: Animal; raisons: string[] }[] {
  const calved = calvedSet(data.animals, data.velages)
  const out: { a: Animal; raisons: string[] }[] = []
  for (const a of data.animals) {
    if (a.sexe !== 'F' || a.statut !== 'present' || categorie(a, today, calved) !== 'vache') continue
    const raisons: string[] = []
    const vels = data.velages.filter((v) => v.mereId === a.id).sort((x, y) => x.date.localeCompare(y.date))
    if (vels.length >= 2) {
      const d = diffDays(vels[vels.length - 2].date, vels[vels.length - 1].date)
      if (d > 420) raisons.push(`Dernier intervalle vêlage-vêlage de ${d} j`)
    }
    const deuxAns = new Date(Date.parse(today) - 730 * 864e5).toISOString().slice(0, 10)
    const vides = data.repros.filter((r) => r.vacheId === a.id && r.diagResultat === 'vide' && r.date >= deuxAns).length
    if (vides >= 2) raisons.push(`${vides} diagnostics « vide » en 2 ans`)
    const difficiles = vels.filter((v) => v.facilite >= 3).length
    if (difficiles >= 2) raisons.push(`${difficiles} vêlages difficiles`)
    const mortNes = vels.filter((v) => v.morNe).length
    if (mortNes >= 2) raisons.push(`${mortNes} veaux mort-nés`)
    const dernier = vels[vels.length - 1]
    const etat = etatRepro(a, data, 'vache')
    if (dernier && diffDays(dernier.date, today) > 548 && etat !== 'pleine' && etat !== 'a-diagnostiquer')
      raisons.push(`Pas de vêlage depuis le ${formatDate(dernier.date)} et non gestante`)
    const age = ageMonths(a.naissance, today)
    if (age !== null && age >= 144) raisons.push(`${Math.floor(age / 12)} ans`)
    if (raisons.length) out.push({ a, raisons })
  }
  return out.sort((x, y) => y.raisons.length - x.raisons.length)
}

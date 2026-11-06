/**
 * Base des médicaments vétérinaires autorisés pour les bovins, extraite des données publiques de l'ANMV
 * (Anses) par scripts/medicaments.py au moment de la publication de l'app. Chargée à la demande,
 * puis disponible hors ligne (cache de l'app).
 */
export interface TempsAttente {
  denree: string // Viande et abats, Lait…
  valeur: string // ex. « 28 jours », « Zéro jour »
  voie: string
}
export interface Medicament {
  id: string
  nom: string
  amm: string
  maj: string // date de mise à jour du RCP
  lien: string // RCP officiel (iRCP)
  forme: string
  substances: string[]
  voies: string[]
  titulaire: string
  attente: TempsAttente[]
  attenteTexte: string // rubrique « Temps d'attente » du RCP
  especes: string
  posologie: string
  indications: string
  contreIndications: string
}
export interface BaseMedicaments {
  date: string // date du jeu de données ANMV
  source: string
  items: Medicament[]
}

let cache: Promise<BaseMedicaments> | null = null
export function chargerMedicaments(): Promise<BaseMedicaments> {
  cache ??= fetch('medicaments.json').then((r) => {
    if (!r.ok) throw new Error('Base des médicaments indisponible pour le moment.')
    return r.json()
  })
  cache.catch(() => (cache = null))
  return cache
}

const plain = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

export function chercher(items: Medicament[], q: string, max = 60): Medicament[] {
  const mots = plain(q).split(/\s+/).filter(Boolean)
  if (!mots.length) return []
  const scored: [number, Medicament][] = []
  for (const m of items) {
    const nom = plain(m.nom)
    const sa = plain(m.substances.join(' '))
    if (!mots.every((w) => nom.includes(w) || sa.includes(w))) continue
    scored.push([nom.startsWith(mots[0]) ? 0 : nom.includes(mots[0]) ? 1 : 2, m])
  }
  return scored.sort((a, b) => a[0] - b[0] || a[1].nom.localeCompare(b[1].nom, 'fr')).slice(0, max).map((x) => x[1])
}

/**
 * Délai d'attente « viande » en jours, pour pré-remplir un soin.
 * Prend le plus long des délais viande indiqués (toutes voies), « zéro » = 0. Null si inconnu.
 */
export function delaiViandeJours(m: Medicament): number | null {
  let max: number | null = null
  for (const t of m.attente) {
    if (!/viande/i.test(t.denree)) continue
    const v = plain(t.valeur)
    const n = /zero/.test(v) ? 0 : Number((v.match(/(\d+(?:[.,]\d+)?)/) ?? [])[1]?.replace(',', '.'))
    if (Number.isNaN(n)) continue
    const jours = /heure/.test(v) ? Math.ceil(n / 24) : n
    max = Math.max(max ?? 0, jours)
  }
  return max
}

/**
 * Repère dans le texte de posologie les doses exprimées par kg de poids vif (« 0,2 mg par kg »,
 * « 1 mL pour 50 kg », « 0,5 mL à 1 mL par kg »), avec l'espèce dont parle le passage,
 * pour proposer un calcul. Toujours indicatif : le texte officiel fait foi.
 */
export interface DoseParKg {
  quantite: number // par kg
  max?: number // borne haute d'une fourchette, par kg
  unite: string // ml, mg, g, µg, UI
  texte: string // extrait d'origine
  espece: string // espèce mentionnée juste avant (« Bovins », « Porcins »…), ou ''
  bovin: boolean
}

const UNITE = String.raw`(ml|mL|mg|µg|μg|g|UI)`
const NB = String.raw`(\d+(?:[.,]\d+)?)`
const ESPECES = /(?<!\p{L})(bovins?|vaches?|veaux|veau|génisses?|ovins?|caprins?|porcins?|porcelets?|porcs?|truies?|équins?|chevaux|poulains?|chiens?|chats?|volailles?|lapins?|agneaux|chevreaux|moutons?)(?!\p{L})/giu

/** Espèce(s) dont parle le passage : celles de la phrase en cours, sinon la dernière citée juste avant. */
function especeAvant(t: string, idx: number): string {
  const avant = t.slice(Math.max(0, idx - 220), idx)
  const cap = (x: string) => x[0].toUpperCase() + x.slice(1).toLowerCase()
  const phrase = avant.slice(avant.lastIndexOf('.') + 1)
  const dansPhrase = [...new Set([...phrase.matchAll(ESPECES)].map((m) => cap(m[1])))]
  if (dansPhrase.length) return dansPhrase.join(', ')
  const tout = [...avant.matchAll(ESPECES)]
  return tout.length ? cap(tout[tout.length - 1][1]) : ''
}

export function dosesParKg(posologie: string): DoseParKg[] {
  const t = posologie.replace(/\u00a0/g, ' ')
  const num = (x: string) => Number(x.replace(/\s/g, '').replace(',', '.'))
  const unite = (u: string) => u.replace('μ', 'µ').replace('mL', 'ml')
  const out: DoseParKg[] = []
  const pris: [number, number][] = [] // zones déjà utilisées
  const libre = (a: number, b: number) => !pris.some(([x, y]) => a < y && b > x)
  const add = (m: RegExpMatchArray, d: Omit<DoseParKg, 'texte' | 'espece' | 'bovin'>) => {
    const a = m.index!, b = a + m[0].length
    if (!libre(a, b) || !(d.quantite > 0) || !Number.isFinite(d.quantite)) return
    pris.push([a, b])
    const espece = especeAvant(t, a)
    out.push({ ...d, texte: m[0].trim(), espece, bovin: !espece || /bovin|vache|veau|génisse/i.test(espece) })
  }
  // 1) fourchette « X à Y unité … par kg »
  for (const m of t.matchAll(new RegExp(`${NB}\\s*(?:${UNITE}\\s*)?à\\s*${NB}\\s*${UNITE}\\b[^.;:\\n]{0,40}?(?:par|/)\\s*kg`, 'g')))
    add(m, { quantite: num(m[1]), max: num(m[3]), unite: unite(m[4]) })
  // 2) « X unité … pour/par Y kg »
  for (const m of t.matchAll(new RegExp(`${NB}\\s*${UNITE}\\b[^.;:\\n]{0,30}?(?:pour|par|/)\\s*(\\d+(?:[ \u00a0]?\\d{3})*(?:[.,]\\d+)?)\\s*kg`, 'g'))) {
    const per = num(m[3])
    if (per > 1) add(m, { quantite: num(m[1]) / per, unite: unite(m[2]) })
  }
  // 3) « X unité … par kg »
  for (const m of t.matchAll(new RegExp(`${NB}\\s*${UNITE}\\b[^.;:\\n]{0,40}?(?:par|/)\\s*kg`, 'g')))
    add(m, { quantite: num(m[1]), unite: unite(m[2]) })
  // dans l'ordre du texte, bovins d'abord
  return out
    .sort((x, y) => Number(y.bovin) - Number(x.bovin) || t.indexOf(x.texte) - t.indexOf(y.texte))
    .slice(0, 8)
}

export function formatDose(v: number): string {
  return v >= 100 ? Math.round(v).toLocaleString('fr-FR') : v.toLocaleString('fr-FR', { maximumFractionDigits: v < 1 ? 3 : 1 })
}

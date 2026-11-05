export type Sexe = 'F' | 'M'
export type Statut = 'present' | 'vendu' | 'mort' | 'reforme'

export interface Base {
  id: string
  updatedAt: number
}

export interface Animal extends Base {
  numero: string // n° national de la boucle
  travail: string // n° de travail
  nom: string
  sexe: Sexe
  naissance: string // YYYY-MM-DD
  mereId: string
  pereId: string
  pereTexte: string // père extérieur au troupeau
  statut: Statut
  dateSortie: string
  notes: string
}

export interface Repro extends Base {
  vacheId: string
  type: 'saillie' | 'IA'
  date: string
  taureauId: string
  taureauTexte: string
  diagDate: string
  diagResultat: '' | 'pleine' | 'vide'
  velageId: string
  notes: string
}

export interface Velage extends Base {
  mereId: string
  date: string
  veauId: string
  sexe: Sexe
  facilite: number // 1 (sans aide) à 4 (césarienne)
  vigueur: number // 1 (faible) à 4 (très vigoureux)
  incidents: string
  poids: number | null
  morNe: boolean
  reproId: string
  notes: string
}

export type TypeSoin = 'vaccin' | 'vermifuge' | 'antibiotique' | 'autre'

export interface Soin extends Base {
  animalIds: string[]
  date: string
  type: TypeSoin
  produit: string
  dose: string
  delaiJours: number // délai d'attente avant abattage
  rappelDate: string
  rappelFait: boolean
  notes: string
}

export type TypeMouvement = 'entree' | 'vente' | 'mort' | 'reforme'

export interface Mouvement extends Base {
  animalId: string
  type: TypeMouvement
  date: string
  acheteur: string
  poids: number | null
  prix: number | null
  notes: string
}

/** Chaleurs observées (le cycle de la vache dure environ 21 jours). */
export interface Chaleur extends Base {
  vacheId: string
  date: string
  notes: string
}

export interface Data {
  animals: Animal[]
  repros: Repro[]
  velages: Velage[]
  soins: Soin[]
  mouvements: Mouvement[]
  chaleurs: Chaleur[]
  gest: number
}

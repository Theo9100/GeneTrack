import { useEffect, useRef, useState } from 'preact/hooks'
import type { Animal, Sexe } from './types'
import { shortId } from './logic'

type Slot =
  | { kind: 'animal'; a: Animal }
  | { kind: 'ext'; text: string; sexe: Sexe }
  | { kind: 'unknown'; sexe: Sexe }

const STATUT_COURT: Record<string, string> = { vendu: 'vendu', mort: 'mort', reforme: 'réformé' }

function slotFor(map: Map<string, Animal>, id: string, ext: string, sexe: Sexe): Slot {
  const a = id ? map.get(id) : undefined
  if (a) return { kind: 'animal', a }
  if (ext) return { kind: 'ext', text: ext, sexe }
  return { kind: 'unknown', sexe }
}
const parentsOf = (map: Map<string, Animal>, s: Slot): [Slot, Slot] =>
  s.kind === 'animal'
    ? [slotFor(map, s.a.mereId, '', 'F'), slotFor(map, s.a.pereId, s.a.pereTexte, 'M')]
    : [{ kind: 'unknown', sexe: 'F' }, { kind: 'unknown', sexe: 'M' }]

/** Chemin coudé à angles arrondis, du bas d'une case au haut d'une autre. */
function elbow(x1: number, y1: number, x2: number, y2: number): string {
  const ym = (y1 + y2) / 2
  if (Math.abs(x2 - x1) < 1) return `M${x1} ${y1}V${y2}`
  const d = Math.sign(x2 - x1)
  const r = Math.min(8, Math.abs(x2 - x1) / 2, (y2 - y1) / 2)
  return `M${x1} ${y1}V${ym - r}Q${x1} ${ym} ${x1 + d * r} ${ym}H${x2 - d * r}Q${x2} ${ym} ${x2} ${ym + r}V${y2}`
}

function Node({ slot, role, x, y, w, h, self }: { slot: Slot; role: string; x: number; y: number; w: number; h: number; self?: boolean }) {
  // Preact 11 n'ajoute plus « px » aux nombres : unités explicites.
  const style = { left: `${x - w / 2}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` }
  if (slot.kind === 'unknown')
    return (
      <div class="node unknown" style={style}>
        <span class="role">{role}</span>
        <span class="meta" style="margin-top:auto">{slot.sexe === 'F' ? 'Inconnue' : 'Inconnu'}</span>
      </div>
    )
  if (slot.kind === 'ext')
    return (
      <div class={`node ext ${slot.sexe}`} style={style} title={slot.text}>
        <span class="role">{role}</span>
        <span class="ext-name">{slot.text}</span>
        <span class="meta">extérieur</span>
      </div>
    )
  const a = slot.a
  return (
    <a
      class={`node ${a.sexe}${self ? ' self' : ''}${a.statut !== 'present' && !self ? ' gone' : ''}`}
      style={style}
      href={`#/animaux/${a.id}`}
      title={[shortId(a), a.nom, a.numero, STATUT_COURT[a.statut]].filter(Boolean).join(' · ')}
    >
      <span class="head">
        <span class="role">{role}</span>
        <span class="meta">{a.naissance.slice(0, 4)}</span>
      </span>
      <span class="tag sm">{shortId(a)}</span>
      <span class="nm">{a.nom || ' '}</span>
    </a>
  )
}

const MAX_INLINE = 8

export function FamilyTree({ animals, id, selfRole }: { animals: Animal[]; id: string; selfRole: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(340)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    // largeur utile = largeur du conteneur moins son rembourrage horizontal (2 × 16 px)
    const measure = () => setWidth(el.clientWidth - 32)
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    measure()
    return () => ro.disconnect()
  }, [])

  const map = new Map(animals.map((a) => [a.id, a]))
  const me = map.get(id)
  if (!me) return null
  const self: Slot = { kind: 'animal', a: me }
  const [mere, pere] = parentsOf(map, self)
  const gps = [...parentsOf(map, mere), ...parentsOf(map, pere)]
  const kids = animals
    .filter((a) => a.mereId === id || a.pereId === id)
    .sort((a, b) => (a.naissance || '9').localeCompare(b.naissance || '9'))

  const showGP = gps.some((g) => g.kind !== 'unknown')
  const inlineKids = kids.length > 0 && kids.length <= MAX_INLINE

  const S = Math.max(78, Math.min(150, width / 4)) // largeur d'une colonne
  const nw = S - 8
  const H = 72
  const G = 30
  const W = Math.max(width, 4 * S, inlineKids ? kids.length * S : 0)
  const cx = W / 2
  const gpY = 0
  const pY = showGP ? H + G : 0
  const sY = pY + H + G
  const kY = sY + H + G
  const selfW = Math.min(nw * 1.4, 190)
  const height = inlineKids ? kY + H : kids.length ? sY + H + 16 : sY + H

  const gpX = [0, 1, 2, 3].map((i) => cx + (i - 1.5) * S)
  const pX = [cx - S, cx + S]
  const kX = kids.map((_, j) => cx + (j - (kids.length - 1) / 2) * S)

  const paths: string[] = []
  if (showGP) gpX.forEach((x, i) => paths.push(elbow(x, gpY + H, pX[i < 2 ? 0 : 1], pY)))
  pX.forEach((x) => paths.push(elbow(x, pY + H, cx, sY)))
  if (inlineKids) kX.forEach((x) => paths.push(elbow(cx, sY + H, x, kY)))
  else if (kids.length) paths.push(`M${cx} ${sY + H}V${height}`)

  const GP_ROLES = ['GM mat.', 'GP mat.', 'GM pat.', 'GP pat.']
  return (
    <div>
      <div class="tree-wrap" ref={ref}>
        <div class="tree" style={{ width: `${W}px`, height: `${height}px` }}>
          <svg class="links" width={W} height={height} aria-hidden="true">
            {paths.map((d, i) => (
              <path key={i} d={d} />
            ))}
          </svg>
          {showGP && gps.map((g, i) => <Node key={'g' + i} slot={g} role={GP_ROLES[i]} x={gpX[i]} y={gpY} w={nw} h={H} />)}
          <Node slot={mere} role="Mère" x={pX[0]} y={pY} w={nw} h={H} />
          <Node slot={pere} role="Père" x={pX[1]} y={pY} w={nw} h={H} />
          <Node slot={self} role={selfRole} x={cx} y={sY} w={selfW} h={H} self />
          {inlineKids &&
            kids.map((k, j) => <Node key={k.id} slot={{ kind: 'animal', a: k }} role={k.sexe === 'F' ? 'Fille' : 'Fils'} x={kX[j]} y={kY} w={nw} h={H} />)}
        </div>
      </div>
      {kids.length > MAX_INLINE && (
        <div class="offspring">
          {kids.map((k) => (
            <a key={k.id} href={`#/animaux/${k.id}`} class={k.statut !== 'present' ? 'gone' : ''}>
              <span class="tag sm">{shortId(k)}</span>
              <span>
                <span class={'sex ' + k.sexe} />
                {k.nom || k.naissance.slice(0, 4)}
              </span>
            </a>
          ))}
        </div>
      )}
      <div class="tree-legend">
        <span><span class="sex F" />Femelle</span>
        <span><span class="sex M" />Mâle</span>
        <span>{kids.length ? `${kids.length} produit${kids.length > 1 ? 's' : ''}` : 'Aucun produit'}</span>
        <span>Estompé : sorti du troupeau</span>
      </div>
    </div>
  )
}

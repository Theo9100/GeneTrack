import { useState } from 'preact/hooks'
import { ChevronRight, TriangleAlert } from 'lucide-preact'
import type { Data } from '../types'
import { Card, Empty, Page, Tag, go, nameOf } from '../ui'
import { aSurveiller, anneesBilan, bilan, IVV_LONG, type Bilan } from '../bilan'
import { isoToday } from '../logic'

const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
const MOIS_LONG = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
const nf = (v: number, d = 0) => v.toLocaleString('fr-FR', { maximumFractionDigits: d, minimumFractionDigits: d })
const pct = (n: number, total: number) => (total ? `${nf((100 * n) / total)} %` : '—')

function Kpi({ value, label, sub }: { value: string; label: string; sub?: string }) {
  return (
    <div class="kpi">
      <b>{value}</b>
      <span>{label}</span>
      {sub && <small>{sub}</small>}
    </div>
  )
}

/** Vêlages par mois : colonnes, une seule série (pas de légende, le titre la nomme). */
function VelagesParMois({ b }: { b: Bilan }) {
  const [survol, setSurvol] = useState<number | null>(null)
  const max = Math.max(...b.parMois)
  const pic = b.parMois.indexOf(max)
  const H = 120
  const ticks = max <= 4 ? Array.from({ length: max + 1 }, (_, i) => i) : [0, Math.ceil(max / 2), max]
  return (
    <div class="chart" role="img" aria-label={`Vêlages par mois en ${b.annee}`}>
      <div class="chart-plot" style={{ height: `${H}px` }}>
        <div class="chart-grid" aria-hidden="true">
          {ticks.map((t) => (
            <div key={t} class="chart-tick" style={{ bottom: `${(t / max) * H}px` }}>
              <span>{t}</span>
            </div>
          ))}
        </div>
        <div class="chart-cols">
          {b.parMois.map((n, i) => (
            <div
              key={i}
              class={'chart-slot' + (survol === i ? ' on' : '')}
              onMouseEnter={() => setSurvol(i)}
              onMouseLeave={() => setSurvol(null)}
              onClick={() => setSurvol(survol === i ? null : i)}
              title={`${MOIS_LONG[i]} : ${n} vêlage${n > 1 ? 's' : ''}`}
            >
              {n > 0 && <div class="chart-bar" style={{ height: `${(n / max) * H}px` }} />}
              {i === pic && n > 0 && max > 4 && survol === null && <span class="chart-cap" style={{ bottom: `${(n / max) * H + 4}px` }}>{n}</span>}
              {survol === i && (
                <span class="chart-tip" style={{ bottom: `${(n / max) * H + 6}px` }}>
                  <b>{n}</b> vêlage{n > 1 ? 's' : ''}
                  <br />
                  {MOIS_LONG[i]}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
      <div class="chart-x">
        {MOIS.map((m) => (
          <span key={m}>{m.slice(0, 1).toUpperCase()}</span>
        ))}
      </div>
      <details class="chart-table">
        <summary>Voir le tableau</summary>
        <table>
          <tbody>
            {b.parMois.map((n, i) => (
              <tr key={i}>
                <td>{MOIS_LONG[i]}</td>
                <td>{n}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  )
}

export function BilanRepro({ data, annee: annee0 }: { data: Data; annee?: string }) {
  const today = isoToday()
  const annees = anneesBilan(data, today)
  const annee = annee0 && annees.includes(annee0) ? annee0 : annees[0]
  const b = bilan(data, annee)
  const surv = aSurveiller(data, today)

  return (
    <Page title="Bilan de reproduction" sub={`Campagne ${annee} · vêlages du 1er janvier au 31 décembre`} back="/repro">
      <div class="chips">
        {annees.map((y) => (
          <button key={y} type="button" class={'btn small' + (y === annee ? ' primary' : '')} onClick={() => go(`/repro/bilan?annee=${y}`)}>
            {y}
          </button>
        ))}
      </div>

      <Card title="Vêlages">
        {b.velages ? (
          <div class="kpis">
            <Kpi value={nf(b.velages)} label={`vêlage${b.velages > 1 ? 's' : ''}`} sub={`${b.femelles} femelle${b.femelles > 1 ? 's' : ''} · ${b.males} mâle${b.males > 1 ? 's' : ''}`} />
            <Kpi value={pct(b.mortNes, b.velages)} label="de mort-nés" sub={`${b.mortNes} sur ${b.velages}`} />
            <Kpi value={pct(b.difficiles, b.velages)} label="de vêlages difficiles" sub={`${b.difficiles} dont ${b.cesariennes} césarienne${b.cesariennes > 1 ? 's' : ''}`} />
            <Kpi value={b.poidsMoyen === null ? '—' : `${nf(b.poidsMoyen, 1)} kg`} label="poids moyen à la naissance" />
          </div>
        ) : (
          <Empty>Aucun vêlage enregistré en {annee}.</Empty>
        )}
      </Card>

      <Card title="Fertilité">
        <div class="kpis">
          <Kpi
            value={b.ivvMoyen === null ? '—' : `${nf(b.ivvMoyen)} j`}
            label="intervalle vêlage-vêlage moyen"
            sub={b.ivvN ? `sur ${b.ivvN} vache${b.ivvN > 1 ? 's' : ''} · ${b.ivvLongs} au-delà de ${IVV_LONG} j · objectif ≈ 365-380 j` : 'il faut deux vêlages par vache'}
          />
          <Kpi
            value={b.tauxGestation === null ? '—' : `${nf(b.tauxGestation)} %`}
            label="de saillies/IA fécondantes"
            sub={b.saillies ? `${b.pleines} pleine${b.pleines > 1 ? 's' : ''} sur ${b.diagnostiquees} résultat${b.diagnostiquees > 1 ? 's' : ''} connu${b.diagnostiquees > 1 ? 's' : ''} (${b.saillies} saillies/IA)` : `aucune saillie/IA en ${annee}`}
          />
          <Kpi
            value={b.agePremierVelage === null ? '—' : `${nf(b.agePremierVelage)} mois`}
            label="âge moyen au 1er vêlage"
            sub={b.primipares ? `${b.primipares} primipare${b.primipares > 1 ? 's' : ''}` : 'aucune primipare'}
          />
        </div>
      </Card>

      {b.velages > 0 && (
        <Card title={`Vêlages par mois en ${annee}`}>
          <VelagesParMois b={b} />
        </Card>
      )}

      <Card title="Vaches à surveiller" count={surv.length}>
        {surv.length ? (
          <ul class="list">
            {surv.map(({ a, raisons }) => (
              <li key={a.id}>
                <Tag a={a} />
                <a class="item wrap" href={`#/animaux/${a.id}`}>
                  <b>{nameOf(a) || 'Sans nom'}</b>
                  {raisons.map((r) => (
                    <small key={r}>
                      <TriangleAlert size={12} /> {r}
                    </small>
                  ))}
                </a>
                <ChevronRight size={18} class="chev" />
              </li>
            ))}
          </ul>
        ) : (
          <Empty>Aucune vache ne cumule de signal d'alerte.</Empty>
        )}
        <p style="margin:12px 0 0">
          <small>
            Signalées si : intervalle vêlage-vêlage &gt; 420 j, 2 diagnostics « vide » en 2 ans, 2 vêlages difficiles, 2 mort-nés, plus de 18 mois sans vêlage
            hors gestation, ou 12 ans et plus. C'est une aide à la décision, pas un verdict.
          </small>
        </p>
      </Card>
    </Page>
  )
}

import { useEffect, useState } from 'preact/hooks'
import { ChevronLeft, Printer } from 'lucide-preact'
import { getSetting } from '../db'
import type { Data } from '../types'
import { formatDate, isoToday } from '../logic'
import { EXPLOITATION_VIDE, lignesRegistre, type Exploitation } from '../registre'

const TYPE: Record<string, string> = { vaccin: 'Vaccin', vermifuge: 'Antiparasitaire', antibiotique: 'Traitement', autre: 'Autre' }

/** Registre des traitements, mis en page pour l'impression A4 paysage (ou l'enregistrement en PDF). */
export function Registre({ data, du, au }: { data: Data; du: string; au: string }) {
  const [ex, setEx] = useState<Exploitation>(EXPLOITATION_VIDE)
  useEffect(() => {
    getSetting<Exploitation>('exploitation', EXPLOITATION_VIDE).then((e) => setEx({ ...EXPLOITATION_VIDE, ...e }))
  }, [])
  const lignes = lignesRegistre(data, du, au)
  const nbAnimaux = new Set(lignes.flatMap((l) => l.animaux.map((a) => a.numero))).size

  return (
    <main class="registre">
      <div class="no-print row" style="margin:16px 0">
        <a class="btn small" href="#/reglages"><ChevronLeft size={16} />Retour</a>
        <button class="primary" onClick={() => window.print()}><Printer size={17} />Imprimer / enregistrer en PDF</button>
      </div>
      <p class="no-print"><small>Sur iPhone : Imprimer, puis écartez l'aperçu avec deux doigts (ou « Enregistrer dans Fichiers ») pour obtenir le PDF.</small></p>

      <header class="reg-head">
        <div>
          <h1>Registre d'élevage — Traitements médicamenteux</h1>
          <p>Période du <b>{formatDate(du)}</b> au <b>{formatDate(au)}</b> · {lignes.length} traitement{lignes.length > 1 ? 's' : ''} · {nbAnimaux} {nbAnimaux > 1 ? 'animaux' : 'animal'}</p>
        </div>
        <dl>
          <dt>Exploitation</dt><dd>{ex.nom || '…………………………'}</dd>
          <dt>N° de cheptel</dt><dd>{ex.cheptel || '…………………………'}</dd>
          <dt>Détenteur</dt><dd>{ex.detenteur || '…………………………'}</dd>
          <dt>Adresse</dt><dd>{ex.adresse || '…………………………'}</dd>
        </dl>
      </header>

      {lignes.length ? (
        <table class="reg-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Animal(aux) traité(s)<br /><small>n° national (n° travail)</small></th>
              <th>Médicament</th>
              <th>Dose / posologie</th>
              <th>Temps d'attente viande</th>
              <th>Fin du temps d'attente</th>
              <th>Prescripteur / ordonnance</th>
              <th>Observations</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((l) => (
              <tr key={l.id}>
                <td class="nw">{formatDate(l.date)}</td>
                <td>
                  {l.animaux.map((a, i) => (
                    <span key={i} class="reg-animal">{a.numero || a.travail}{a.numero && a.travail ? ` (${a.travail})` : ''}</span>
                  ))}
                </td>
                <td><b>{l.produit || '—'}</b><br /><small>{TYPE[l.type]}</small></td>
                <td>{l.dose || '—'}</td>
                <td class="nw">{l.delaiJours > 0 ? `${l.delaiJours} j` : 'Aucun'}</td>
                <td class="nw">{l.finAttente ? formatDate(l.finAttente) : '—'}</td>
                <td>{[l.veterinaire, l.ordonnance].filter(Boolean).join(' · ') || '—'}</td>
                <td>{l.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p class="empty">Aucun traitement enregistré sur cette période.</p>
      )}

      <footer class="reg-foot">
        <p>Les ordonnances correspondantes sont à conserver avec ce registre pendant 5 ans.</p>
        <p>Édité le {formatDate(isoToday())} avec GeneTrack. Signature du détenteur : ………………………………</p>
      </footer>
    </main>
  )
}

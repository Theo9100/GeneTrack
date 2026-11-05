import { useEffect, useState } from 'preact/hooks'
import { GESTATION_DEFAUT, getSetting, setSetting } from '../db'
import { exportData, importData, parseBackup } from '../backup'
import { setPassword, verifyPassword } from '../auth'
import type { Data } from '../types'
import { CalendarDays, Download, FileSpreadsheet, Lock as LockIcon } from 'lucide-preact'
import { Card, Form, Page, download, remove } from '../ui'
import { planTout } from '../remove'
import { cloudEnabled } from '../config'
import { cloudLogout, useSyncStatus } from '../cloud'
import { SYNC_LABEL } from '../syncbadge'
import { agenda, buildIcs, isoToday, label, toCSV } from '../logic'

export function Reglages({ data, onLock }: { data: Data; onLock: () => void }) {
  const [msg, setMsg] = useState('')
  const [mode, setMode] = useState<'merge' | 'replace'>('merge')
  const [persist, setPersist] = useState<string>('')
  const [last, setLast] = useState<number | null>(null)
  const sync = useSyncStatus()
  const today = isoToday()
  useEffect(() => {
    getSetting<number | null>('lastBackup', null).then(setLast)
    navigator.storage?.persisted?.().then((p) => setPersist(p ? 'Stockage protégé : oui' : 'Stockage protégé : non'))
  }, [msg])

  async function sauvegarder() {
    const f = await exportData()
    download(`genetrack-${today}.json`, JSON.stringify(f, null, 1), 'application/json')
    setMsg('Sauvegarde téléchargée. Gardez-la sur une clé USB ou votre PC.')
  }
  async function reinitialiser() {
    const nAnimaux = data.animals.length
    const nSaisies = data.repros.length + data.velages.length + data.soins.length + data.mouvements.length + data.chaleurs.length
    if (!nAnimaux && !nSaisies) return setMsg('Le troupeau est déjà vide.')
    const rep = prompt(
      `Cette action efface ${nAnimaux} animal(aux) et ${nSaisies} saisie(s)${cloudEnabled ? ' sur TOUS vos appareils synchronisés' : ' de cet appareil'}.\n` +
        `Une sauvegarde sera téléchargée juste avant.\n\nPour confirmer, tapez SUPPRIMER :`,
    )
    if (rep?.trim().toUpperCase() !== 'SUPPRIMER') return
    await sauvegarder()
    await remove(planTout(data))
    setMsg('Troupeau réinitialisé. La sauvegarde téléchargée permet de tout restaurer (Importer → Remplacer tout).')
  }
  async function restaurer(file: File | undefined) {
    if (!file) return
    try {
      const b = parseBackup(await file.text())
      if (mode === 'replace' && !confirm('Remplacer TOUTES les données de cet appareil par celles du fichier ?')) return
      const r = await importData(b, mode)
      setMsg(`Import terminé : ${r.ajoutes} ajouté(s), ${r.misAJour} mis à jour, ${r.ignores} inchangé(s).`)
    } catch (e) {
      setMsg('Erreur : ' + (e instanceof Error ? e.message : String(e)))
    }
  }
  const byId = new Map(data.animals.map((a) => [a.id, a]))
  const csv = (nom: string, rows: any[], cols: string[]) => download(`genetrack-${nom}-${today}.csv`, toCSV(rows, cols), 'text/csv;charset=utf-8')
  const ics = () => {
    const ev = agenda(data, today, { velage: 400, autre: 400 })
    if (!ev.length) return setMsg('Aucun événement à exporter.')
    download(`genetrack-agenda-${today}.ics`, buildIcs(ev), 'text/calendar;charset=utf-8')
    setMsg(`${ev.length} événement(s) exporté(s). Ouvrez le fichier pour l'ajouter à votre calendrier.`)
  }

  return (
    <Page title="Réglages" sub="Sauvegardes, exports et sécurité" back="/">
      {msg && <p class={"banner " + (msg.startsWith('Erreur') ? 'bad' : 'ok')}>{msg}</p>}
      <Card title="Synchronisation">
        {cloudEnabled ? (
          <>
            <p>
              <b>{SYNC_LABEL[sync.state]}</b>
              {sync.email && <> · compte <b>{sync.email}</b></>}
              {sync.lastSync && sync.state === 'synced' && <> · {new Date(sync.lastSync).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</>}
            </p>
            {sync.error && sync.state === 'error' && <p class="error">{sync.error}</p>}
            <p><small>Toutes vos saisies sont envoyées automatiquement sur vos autres appareils connectés au même compte. Hors ligne, elles partent dès le retour du réseau.</small></p>
            <button class="small" onClick={async () => {
              if (!confirm('Se déconnecter ? Les données restent sur cet appareil mais ne seront plus synchronisées.')) return
              await cloudLogout()
              onLock()
            }}>Se déconnecter</button>
          </>
        ) : (
          <p><small>Non configurée : les données restent sur cet appareil. Pour synchroniser tous vos appareils (gratuit), suivez la section « Synchronisation » du README.</small></p>
        )}
      </Card>
      <Card title="Sauvegarde et transfert">
        <p>
          Vos données sont <b>uniquement sur cet appareil</b>. {last ? `Dernière sauvegarde : ${new Date(last).toLocaleDateString('fr-FR')}.` : 'Aucune sauvegarde faite.'} {persist}
        </p>
        <div class="row">
          <button class="primary" onClick={sauvegarder}><Download size={17} />Exporter une sauvegarde (.json)</button>
        </div>
        <hr />
        <label>
          <span>Importer une sauvegarde</span>
          <select value={mode} onChange={(e) => setMode(e.currentTarget.value as 'merge' | 'replace')}>
            <option value="merge">Fusionner (garde la version la plus récente de chaque fiche)</option>
            <option value="replace">Remplacer tout</option>
          </select>
          <input type="file" accept=".json,application/json" onChange={(e) => { restaurer(e.currentTarget.files?.[0]); e.currentTarget.value = '' }} />
        </label>
        <small>Pour passer du téléphone au PC : exportez sur l'un, importez sur l'autre. La fusion n'efface rien.</small>
      </Card>
      <Card title="Calendrier et tableurs">
        <div class="row">
          <button onClick={ics}><CalendarDays size={17} />Exporter le calendrier (.ics)</button>
        </div>
        <small>À importer dans Google Calendar ou le Calendrier iPhone pour être prévenu par notification ou e-mail (vêlages, diagnostics, rappels).</small>
        <hr />
        <div class="section-title"><FileSpreadsheet size={14} />Tableurs (CSV)</div>
        <div class="row">
          <button class="small" onClick={() => csv('animaux', data.animals.map((a) => ({ ...a, mere: label(byId.get(a.mereId)), pere: a.pereId ? label(byId.get(a.pereId)) : a.pereTexte })), ['numero', 'travail', 'nom', 'sexe', 'naissance', 'mere', 'pere', 'statut', 'dateSortie', 'notes'])}>Animaux</button>
          <button class="small" onClick={() => csv('reproduction', data.repros.map((r) => ({ ...r, vache: label(byId.get(r.vacheId)), taureau: r.taureauId ? label(byId.get(r.taureauId)) : r.taureauTexte })), ['vache', 'type', 'date', 'taureau', 'diagResultat', 'diagDate', 'notes'])}>Reproduction</button>
          <button class="small" onClick={() => csv('velages', data.velages.map((v) => ({ ...v, mere: label(byId.get(v.mereId)), veau: label(byId.get(v.veauId)) })), ['date', 'mere', 'veau', 'sexe', 'morNe', 'facilite', 'vigueur', 'poids', 'incidents', 'notes'])}>Vêlages</button>
          <button class="small" onClick={() => csv('soins', data.soins.map((s) => ({ ...s, animaux: s.animalIds.map((i) => label(byId.get(i))) })), ['date', 'type', 'produit', 'dose', 'delaiJours', 'rappelDate', 'animaux', 'notes'])}>Soins</button>
          <button class="small" onClick={() => csv('chaleurs', data.chaleurs.map((c) => ({ ...c, vache: label(byId.get(c.vacheId)) })), ['date', 'vache', 'notes'])}>Chaleurs</button>
          <button class="small" onClick={() => csv('mouvements', data.mouvements.map((m) => ({ ...m, animal: label(byId.get(m.animalId)) })), ['date', 'type', 'animal', 'acheteur', 'poids', 'prix', 'notes'])}>Mouvements</button>
        </div>
      </Card>
      <Card title="Paramètres">
        <Form
          fields={[{ name: 'gest', label: 'Durée de gestation (jours)', type: 'number', hint: `Blonde d'Aquitaine : environ ${GESTATION_DEFAUT} jours.` }]}
          initial={{ gest: String(data.gest) }}
          onSubmit={async (v) => {
            const g = Math.round(Number(v.gest))
            if (!(g >= 250 && g <= 320)) throw new Error('Entrez une valeur entre 250 et 320 jours.')
            await setSetting('gestationJours', g)
            setMsg('Durée de gestation enregistrée.')
          }}
        />
      </Card>
      <section class="card danger-zone">
        <h2>Réinitialiser le troupeau</h2>
        <p>
          Efface tous les animaux et toutes les saisies{cloudEnabled ? ', sur tous vos appareils synchronisés' : ''}. Le mot de passe, le compte et les réglages sont conservés.
        </p>
        <p><small>Une sauvegarde est téléchargée automatiquement juste avant, et vous pouvez annuler pendant quelques secondes.</small></p>
        <button class="danger-solid" onClick={reinitialiser}>Réinitialiser le troupeau…</button>
      </section>
      <Card title="Mot de passe">
        <Form
          fields={[
            { name: 'old', label: 'Mot de passe actuel', type: 'password' },
            { name: 'new', label: 'Nouveau mot de passe', type: 'password', hint: '4 caractères minimum.' },
          ]}
          initial={{ old: '', new: '' }}
          submitLabel="Changer"
          onSubmit={async (v) => {
            if (!(await verifyPassword(String(v.old)))) throw new Error('Mot de passe actuel incorrect.')
            if (String(v.new).length < 4) throw new Error('Mot de passe trop court.')
            await setPassword(String(v.new))
            setMsg('Mot de passe modifié.')
          }}
        />
        <p><small>Le mot de passe verrouille l'accès à l'application ; il ne chiffre pas les fichiers exportés.</small></p>
        <button onClick={onLock}><LockIcon size={16} />Verrouiller maintenant</button>
      </Card>
    </Page>
  )
}

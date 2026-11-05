/**
 * Envoi des alertes par e-mail (exécuté chaque matin par .github/workflows/alertes.yml).
 *
 * Lit les données synchronisées dans Firestore, calcule les événements pour lesquels une alerte
 * doit partir aujourd'hui (vêlages J-7 et J-2, chaleurs J-2, diagnostics et rappels J-3) et envoie
 * un e-mail récapitulatif via Gmail. Rien n'est envoyé s'il n'y a rien à signaler.
 *
 * Essai local sans Firebase ni envoi, à partir d'une sauvegarde exportée de l'app :
 *   npx tsx scripts/alertes.ts --file sauvegarde.json --date 2026-11-20 --dry-run
 */
import { readFileSync } from 'node:fs'
import { alertesDuJour, isoToday } from '../src/logic'
import { buildEmail } from '../src/emails'
import type { Data } from '../src/types'

const TABLES = ['animals', 'repros', 'velages', 'soins', 'mouvements', 'chaleurs'] as const
const arg = (name: string) => {
  const i = process.argv.indexOf(name)
  return i > 0 ? process.argv[i + 1] : undefined
}
const env = process.env
const today = arg('--date') ?? isoToday()
const dryRun = process.argv.includes('--dry-run')
const [owner, repo] = (env.GITHUB_REPOSITORY ?? '/').split('/')
const appUrl = env.APP_URL || (owner ? `https://${owner.toLowerCase()}.github.io/${repo}/` : 'https://github.io/')
const gestDefaut = Number(env.GESTATION_JOURS) || 285
const notice = (m: string) => console.log(env.GITHUB_ACTIONS ? `::notice::${m}` : m)

async function troupeaux(): Promise<{ id: string; data: Data }[]> {
  const file = arg('--file')
  if (file) {
    const b = JSON.parse(readFileSync(file, 'utf8'))
    return [{ id: file, data: { ...b, chaleurs: b.chaleurs ?? [], gest: b.gestationJours ?? gestDefaut } }]
  }
  if (!env.FIREBASE_SERVICE_ACCOUNT) {
    notice('Secret FIREBASE_SERVICE_ACCOUNT absent : synchronisation non configurée, aucune alerte envoyée.')
    return []
  }
  const { initializeApp, cert } = await import('firebase-admin/app')
  const { getFirestore } = await import('firebase-admin/firestore')
  initializeApp({ credential: cert(JSON.parse(env.FIREBASE_SERVICE_ACCOUNT)) })
  const fs = getFirestore()
  const out: { id: string; data: Data }[] = []
  for (const herd of await fs.collection('herds').listDocuments()) {
    const data = { gest: gestDefaut } as Data
    for (const t of TABLES) {
      const snap = await herd.collection(t).get()
      ;(data as unknown as Record<string, unknown[]>)[t] = snap.docs.map((d) => d.data()).filter((d) => !d.deleted)
    }
    out.push({ id: herd.id, data })
  }
  return out
}

async function main() {
  const herds = await troupeaux()
  for (const { id, data } of herds) {
    const alertes = alertesDuJour(data, today)
    const mail = buildEmail(alertes, today, appUrl)
    console.log(`Troupeau ${id.slice(0, 6)}… : ${data.animals.length} animaux, ${alertes.length} alerte(s) le ${today}.`)
    if (!mail) continue
    if (dryRun) {
      console.log(`\nObjet : ${mail.subject}\n\n${mail.text}\n`)
      continue
    }
    if (!env.GMAIL_USER || !env.GMAIL_APP_PASSWORD) {
      notice('Secrets GMAIL_USER / GMAIL_APP_PASSWORD absents : e-mail non envoyé.')
      continue
    }
    const nodemailer = (await import('nodemailer')).default
    const transport = nodemailer.createTransport({ service: 'gmail', auth: { user: env.GMAIL_USER, pass: env.GMAIL_APP_PASSWORD } })
    await transport.sendMail({ from: `GeneTrack <${env.GMAIL_USER}>`, to: env.ALERT_EMAIL_TO || env.GMAIL_USER, ...mail })
    console.log(`E-mail envoyé : ${mail.subject}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

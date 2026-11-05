import { diffDays, formatDate, type Alerte, type AlerteKind } from './logic'

const SECTION: Record<AlerteKind, string> = {
  velage: 'Vêlages',
  chaleur: 'Chaleurs',
  diag: 'Diagnostics de gestation',
  rappel: 'Rappels de santé',
  attente: "Fins de délai d'attente",
}
const ORDER: AlerteKind[] = ['velage', 'chaleur', 'diag', 'rappel', 'attente']

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const quand = (today: string, date: string) => {
  const j = diffDays(today, date)
  return j === 0 ? "aujourd'hui" : j === 1 ? 'demain' : `dans ${j} jours`
}

export interface Email {
  subject: string
  text: string
  html: string
}

/** E-mail récapitulatif des événements à venir (null s'il n'y a rien à signaler). */
export function buildEmail(alertes: Alerte[], today: string, appUrl: string): Email | null {
  if (!alertes.length) return null
  const kinds = ORDER.filter((k) => alertes.some((a) => a.kind === k))
  const subject = `GeneTrack · ${alertes.length} alerte${alertes.length > 1 ? 's' : ''} : ${kinds.map((k) => SECTION[k].toLowerCase()).join(', ')}`
  const link = (a: Alerte) => `${appUrl.replace(/\/?$/, '/')}#${a.lien}`

  const text = [
    `Bonjour,`,
    ``,
    ...kinds.flatMap((k) => [
      `${SECTION[k].toUpperCase()}`,
      ...alertes.filter((a) => a.kind === k).map((a) => `- ${formatDate(a.date)} (${quand(today, a.date)}) : ${a.titre}\n  ${a.detail}\n  ${link(a)}`),
      ``,
    ]),
    `— GeneTrack`,
  ].join('\n')

  const rows = kinds
    .map(
      (k) => `
    <tr><td style="padding:18px 0 6px;font:600 12px/1 Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#8f8778">${SECTION[k]}</td></tr>
    ${alertes
      .filter((a) => a.kind === k)
      .map(
        (a) => `<tr><td style="padding:10px 14px;background:#fffdf8;border:1px solid #e4ddce;border-radius:10px">
        <a href="${esc(link(a))}" style="color:#1d1a14;text-decoration:none">
          <div style="font:600 15px/1.35 Arial,sans-serif">${esc(a.titre)}</div>
          <div style="font:13px/1.45 Arial,sans-serif;color:#5f584b;margin-top:2px"><b style="color:#a2622a">${formatDate(a.date)} · ${quand(today, a.date)}</b> — ${esc(a.detail)}</div>
        </a></td></tr><tr><td style="height:8px"></td></tr>`,
      )
      .join('')}`,
    )
    .join('')

  const html = `<!doctype html><html lang="fr"><body style="margin:0;background:#f4f0e7;padding:24px 12px">
  <table role="presentation" width="100%" style="max-width:560px;margin:0 auto;border-collapse:separate">
    <tr><td style="font:600 24px/1.2 Georgia,serif;color:#1d1a14">GeneTrack</td></tr>
    <tr><td style="font:14px/1.5 Arial,sans-serif;color:#5f584b;padding-top:4px">Événements à venir dans votre troupeau</td></tr>
    ${rows}
    <tr><td style="padding-top:18px"><a href="${esc(appUrl)}" style="display:inline-block;background:#1d1a14;color:#fbf7ee;font:600 14px Arial,sans-serif;padding:11px 16px;border-radius:10px;text-decoration:none">Ouvrir GeneTrack</a></td></tr>
  </table></body></html>`
  return { subject, text, html }
}

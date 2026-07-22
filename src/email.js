import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'
import { config } from './config.js'
import { db } from './db.js'

// Expéditeurs considérés comme des alertes billetterie (filtre anti-bruit).
const SENDERS = [
  'ticketmaster',
  'fnac',
  'francebillet',
  'seetickets',
  'digitick',
  'weezevent',
  'shotgun',
  'dice',
  'eventim',
]

export function emailConfigured() {
  return Boolean(config.imap.host && config.imap.user && config.imap.pass)
}

function pickUrl(text = '', html = '') {
  const urls = [...`${text}\n${html}`.matchAll(/https?:\/\/[^\s"'<>)]+/g)].map((m) => m[0])
  return urls.find((u) => SENDERS.some((s) => u.toLowerCase().includes(s))) || urls[0] || null
}

/**
 * Surveille la boîte mail en IMAP et relaie les nouvelles alertes billetterie.
 * Lecture seule : on ne modifie AUCUN mail (pas de flag "lu"). On suit le dernier
 * UID traité, stocké en base, pour ne relayer que les nouveaux messages.
 */
export async function startEmailWatch(handler) {
  const client = new ImapFlow({
    host: config.imap.host,
    port: config.imap.port,
    secure: true,
    auth: { user: config.imap.user, pass: config.imap.pass },
    logger: false,
  })

  await client.connect()
  console.log(`📧 Veille email active (${config.imap.user}) — vérif toutes les ${config.imap.pollMs / 1000}s.`)

  let stopped = false

  async function poll() {
    if (stopped) return
    const lock = await client.getMailboxLock('INBOX')
    try {
      const status = await client.status('INBOX', { uidNext: true })
      let last = db.data.meta.lastEmailUid

      // Premier lancement : on prend la boîte comme point de départ (pas de vieux mails).
      if (last == null) {
        db.data.meta.lastEmailUid = (status.uidNext ?? 1) - 1
        await db.write()
        return
      }

      // On ne récupère d'abord que l'en-tête (expéditeur/objet). Le corps du mail
      // n'est téléchargé QUE si l'expéditeur est une billetterie → vie privée préservée.
      for await (const msg of client.fetch({ uid: `${last + 1}:*` }, { uid: true, envelope: true }, { uid: true })) {
        if (msg.uid <= last) continue // l'IMAP renvoie toujours le dernier UID, on le saute
        last = Math.max(last, msg.uid)

        const from = (msg.envelope?.from?.[0]?.address || '').toLowerCase()
        if (!SENDERS.some((s) => from.includes(s))) continue

        const full = await client.fetchOne(msg.uid, { source: true }, { uid: true })
        const parsed = await simpleParser(full.source)
        await handler({
          from,
          subject: msg.envelope?.subject || '(sans objet)',
          url: pickUrl(parsed.text, parsed.html || ''),
        })
      }

      if (last !== db.data.meta.lastEmailUid) {
        db.data.meta.lastEmailUid = last
        await db.write()
      }
    } catch (err) {
      console.error('[email]', err.message)
    } finally {
      lock.release()
    }

    if (!stopped) setTimeout(poll, config.imap.pollMs)
  }

  poll()

  return async () => {
    stopped = true
    try {
      await client.logout()
    } catch {}
  }
}

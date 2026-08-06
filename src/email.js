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

// Plafond de l'attente entre deux tentatives quand la connexion est cassée.
const MAX_BACKOFF_MS = 15 * 60_000

/**
 * Surveille la boîte mail en IMAP et relaie les nouvelles alertes billetterie.
 * Lecture seule : on ne modifie AUCUN mail (pas de flag "lu"). On suit le dernier
 * UID traité, stocké en base, pour ne relayer que les nouveaux messages.
 *
 * Tourne 24/7 : Gmail ferme les connexions inactives et le réseau d'une VM a des
 * hoquets, donc toute erreur est rattrapée, la connexion est jetée puis refaite au
 * passage suivant (attente doublée à chaque échec). Cette fonction ne rejette jamais.
 */
export async function startEmailWatch(handler) {
  let stopped = false
  let client = null
  let failures = 0
  let timer = null

  const nextDelayMs = () =>
    failures === 0
      ? config.imap.pollMs
      : Math.min(config.imap.pollMs * 2 ** (failures - 1), MAX_BACKOFF_MS)

  async function dropClient() {
    const c = client
    client = null
    if (!c) return
    try {
      await c.logout()
    } catch {
      try {
        c.close()
      } catch {}
    }
  }

  async function getClient() {
    if (client?.usable) return client
    await dropClient()
    const c = new ImapFlow({
      host: config.imap.host,
      port: config.imap.port,
      secure: true,
      auth: { user: config.imap.user, pass: config.imap.pass },
      logger: false,
    })
    // Sans écouteur 'error', une coupure réseau ferait tomber tout le process.
    c.on('error', (err) => console.error('[email] connexion perdue :', err.message))
    await c.connect()
    client = c
    console.log(`📧 Connecté à la boîte ${config.imap.user}.`)
    return c
  }

  async function pollOnce() {
    const c = await getClient()
    const lock = await c.getMailboxLock('INBOX')
    try {
      const status = await c.status('INBOX', { uidNext: true })
      let last = db.data.meta.lastEmailUid

      // Premier lancement : on prend la boîte comme point de départ (pas de vieux mails).
      if (last == null) {
        db.data.meta.lastEmailUid = (status.uidNext ?? 1) - 1
        await db.write()
        return
      }

      // On ne récupère d'abord que l'en-tête (expéditeur/objet). Le corps du mail
      // n'est téléchargé QUE si l'expéditeur est une billetterie → vie privée préservée.
      for await (const msg of c.fetch({ uid: `${last + 1}:*` }, { uid: true, envelope: true }, { uid: true })) {
        if (msg.uid <= last) continue // l'IMAP renvoie toujours le dernier UID, on le saute
        last = Math.max(last, msg.uid)

        const from = (msg.envelope?.from?.[0]?.address || '').toLowerCase()
        if (!SENDERS.some((s) => from.includes(s))) continue

        const full = await c.fetchOne(msg.uid, { source: true }, { uid: true })
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
    } finally {
      lock.release()
    }
  }

  async function loop() {
    if (stopped) return
    try {
      await pollOnce()
      failures = 0
    } catch (err) {
      failures += 1
      await dropClient() // repart d'une connexion neuve au prochain passage
      console.error(`[email] ${err.message} — nouvelle tentative dans ${Math.round(nextDelayMs() / 1000)}s (échec n°${failures})`)
    }
    if (!stopped) timer = setTimeout(loop, nextDelayMs())
  }

  console.log(`📧 Veille email active (${config.imap.user}) — vérif toutes les ${config.imap.pollMs / 1000}s.`)
  loop().catch((err) => console.error('[email] boucle interrompue :', err.message))

  return async () => {
    stopped = true
    clearTimeout(timer)
    await dropClient()
  }
}

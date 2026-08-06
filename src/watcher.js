import { db } from './db.js'
import { bot } from './bot.js'
import { config, isAllowedChat } from './config.js'
import { searchEvents } from './ticketmaster.js'
import { evaluateEvent, eventSummary, eventKeyboard } from './events.js'

const HEADERS = {
  new: '🆕 Nouvel event repéré',
  soon: '⏰ Ouverture des ventes bientôt',
  onsale: '🚨 C’EST OUVERT — go !',
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ─────────── Veille TM (API, mondiale) ───────────
async function runTmWatch(watch) {
  const events = await searchEvents(watch.keyword)
  for (const ev of events) {
    const key = `${watch.chatId}:${ev.id}`
    const state = db.data.seen[key] ?? {}
    const alerts = evaluateEvent(ev, state)
    db.data.seen[key] = state

    for (const kind of alerts) {
      await bot.api
        .sendMessage(watch.chatId, `${HEADERS[kind]}\n\n${eventSummary(ev)}`, {
          parse_mode: 'HTML',
          reply_markup: eventKeyboard(ev),
        })
        .catch((e) => console.error(`[envoi ${key}] ${e.message}`))
    }
  }
  await db.write()
}

// Un seul cycle à la fois : /check et le minuteur peuvent tomber en même temps,
// et deux cycles concurrents enverraient l'alerte en double.
let cycleRunning = false

/**
 * Un cycle de veille : parcourt toutes les veilles.
 * Retourne false si un cycle était déjà en cours (rien n'a été fait).
 */
export async function runWatchCycle() {
  if (cycleRunning) {
    console.log('[veille] cycle déjà en cours — passage ignoré')
    return false
  }
  cycleRunning = true
  try {
    for (const watch of db.data.watches) {
      // La liste blanche vaut aussi en sortie : une veille créée par un inconnu
      // avant le verrouillage cesse d'émettre.
      if (!isAllowedChat(watch.chatId)) continue
      // Anciennes veilles de page d'une base existante : plus supportées.
      if (watch.type && watch.type !== 'tm') continue
      try {
        await runTmWatch(watch)
      } catch (err) {
        console.error(`[veille #${watch.id}] ${err.message}`)
      }
      await sleep(300) // petit délai entre les veilles
    }
  } finally {
    cycleRunning = false
  }
  return true
}

/** Démarre la boucle de veille périodique. */
export function startWatcher() {
  const minutes = config.pollIntervalMs / 60_000
  console.log(`🔭 Veille active — un cycle toutes les ${minutes} min.`)
  runWatchCycle().catch((e) => console.error(e))
  return setInterval(() => runWatchCycle().catch((e) => console.error(e)), config.pollIntervalMs)
}

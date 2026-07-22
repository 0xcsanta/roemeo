import { db, setWatchStatus } from './db.js'
import { bot } from './bot.js'
import { config } from './config.js'
import { searchEvents } from './ticketmaster.js'
import { checkUrl } from './pagewatch.js'
import { evaluateEvent, eventSummary, eventKeyboard, pageAlert, pageKeyboard } from './events.js'

const HEADERS = {
  new: '🆕 Nouvel event repéré',
  soon: '⏰ Ouverture des ventes bientôt',
  onsale: '🚨 C’EST OUVERT — go !',
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ─────────── Veille TM (API, international) ───────────
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

// ─────────── Veille de page FR (Playwright) ───────────
async function runPageWatch(watch) {
  const { status, title } = await checkUrl(watch.url)
  const prev = watch.lastStatus ?? 'unknown'

  if (status !== prev) {
    // Seule transition qui déclenche une alerte : ça devient achetable.
    if (status === 'onsale') {
      await bot.api
        .sendMessage(watch.chatId, pageAlert(watch, status, title, prev === 'soldout'), {
          parse_mode: 'HTML',
          reply_markup: pageKeyboard(watch),
        })
        .catch((e) => console.error(`[envoi page #${watch.id}] ${e.message}`))
    }
    await setWatchStatus(watch.id, status)
  }
}

/** Un cycle de veille : parcourt toutes les veilles (TM + pages). */
export async function runWatchCycle() {
  for (const watch of db.data.watches) {
    try {
      if (watch.type === 'page') {
        if (!config.pageWatchEnabled) continue // serveur sans écran : on saute
        await runPageWatch(watch)
      } else {
        await runTmWatch(watch)
      }
    } catch (err) {
      console.error(`[veille #${watch.id}] ${err.message}`)
    }
    await sleep(300) // petit délai entre les veilles
  }
}

/** Démarre la boucle de veille périodique. */
export function startWatcher() {
  const minutes = config.pollIntervalMs / 60_000
  console.log(`🔭 Veille active — un cycle toutes les ${minutes} min.`)
  runWatchCycle().catch((e) => console.error(e))
  return setInterval(() => runWatchCycle().catch((e) => console.error(e)), config.pollIntervalMs)
}

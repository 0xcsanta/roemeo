import { Bot } from 'grammy'
import { config } from './config.js'
import { db, addSubscriber, addWatch, listWatches, removeWatch, setWatchStatus } from './db.js'
import { searchEvents } from './ticketmaster.js'
import { detectPlatform } from './platforms.js'
import { checkUrl } from './pagewatch.js'
import {
  evaluateEvent,
  eventSummary,
  eventKeyboard,
  pageKeyboard,
  escHtml,
  STATUS_LABEL,
} from './events.js'

export const bot = new Bot(config.telegramToken)

// /whoami : donne l'ID du chat (pour remplir ALLOWED_CHAT_IDS). Accessible à tous.
bot.command('whoami', (ctx) =>
  ctx.reply(`🪪 Ton ID Telegram : <code>${ctx.chat.id}</code>`, { parse_mode: 'HTML' })
)

// Garde d'accès : si une liste blanche est définie, on ignore les autres comptes.
bot.use(async (ctx, next) => {
  const ids = config.allowedChatIds
  const chatId = ctx.chat?.id
  if (ids.length === 0) {
    if (chatId) {
      console.log(`👤 chat ${chatId} — ${ctx.from?.first_name ?? ''} @${ctx.from?.username ?? ''}`)
    }
    return next()
  }
  if (chatId && ids.includes(chatId)) return next()
  await ctx.reply('⛔ Accès restreint à cet assistant.').catch(() => {})
})

const HELP = [
  '🎟️ <b>Roméo Bot</b> — veille billetterie',
  '',
  "Je te préviens dès qu'un event ouvre à la vente. L'achat reste un clic humain.",
  '',
  '<b>Suivre quelque chose</b>',
  '• /watch &lt;artiste&gt; — veille internationale via l’API Ticketmaster',
  '   ex : <code>/watch Coldplay</code>',
  '• /watch &lt;lien&gt; — veille d’une page FR (Ticketmaster.fr, Fnac…)',
  '   ex : <code>/watch https://www.ticketmaster.fr/event/…</code>',
  '',
  '<b>Gérer</b>',
  '• /list — mes veilles',
  '• /unwatch &lt;id&gt; — arrêter une veille',
  '• /check — forcer une vérification maintenant',
  '• /help — cette aide',
].join('\n')

bot.command(['start', 'help'], async (ctx) => {
  await addSubscriber(ctx.chat.id)
  await ctx.reply(HELP, { parse_mode: 'HTML' })
})

bot.command('watch', async (ctx) => {
  const arg = ctx.match?.trim()
  if (!arg) {
    return ctx.reply(
      'Usage :\n• /watch <artiste>  (international)\n• /watch <lien d’un event>  (France : ticketmaster.fr, Fnac…)'
    )
  }
  await addSubscriber(ctx.chat.id)
  if (/^https?:\/\//i.test(arg)) return addPageWatch(ctx, arg)
  return addTmWatch(ctx, arg)
})

// ─────────── Veille internationale (API Ticketmaster) ───────────
async function addTmWatch(ctx, keyword) {
  const watch = await addWatch(ctx.chat.id, { type: 'tm', keyword })

  let events = []
  try {
    events = await searchEvents(keyword)
  } catch (err) {
    return ctx.reply(`✅ Veille #${watch.id} créée pour « ${keyword} », mais la recherche a échoué : ${err.message}`)
  }

  // Baseline silencieuse : on n'alerte ensuite que sur les nouveautés / ouvertures.
  for (const ev of events) {
    const key = `${ctx.chat.id}:${ev.id}`
    const state = db.data.seen[key] ?? {}
    evaluateEvent(ev, state, { silent: true })
    db.data.seen[key] = state
  }
  await db.write()

  if (events.length === 0) {
    return ctx.reply(
      `✅ Veille #${watch.id} créée pour « ${keyword} » (international). Aucun event listé pour l'instant — je te préviens dès qu'il y en a.`
    )
  }

  await ctx.reply(`✅ Veille #${watch.id} — « ${keyword} ». ${events.length} event(s) déjà listé(s) :`)
  for (const ev of events.slice(0, 5)) {
    await ctx.reply(eventSummary(ev), { parse_mode: 'HTML', reply_markup: eventKeyboard(ev) })
  }
  if (events.length > 5) {
    await ctx.reply(`… et ${events.length - 5} autre(s). Je t'alerte sur les nouveautés et les ouvertures de vente.`)
  }
}

// ─────────── Veille d'une page FR (Playwright) ───────────
async function addPageWatch(ctx, url) {
  if (!config.pageWatchEnabled) {
    return ctx.reply(
      'ℹ️ La surveillance de page est désactivée ici (serveur sans écran). Pour Ticketmaster.fr et Fnac, passe par le relais email — tu seras alerté pareil.'
    )
  }
  const platform = detectPlatform(url)
  if (!platform) return ctx.reply('Lien invalide. Colle l’URL complète de la page de l’event.')

  const watch = await addWatch(ctx.chat.id, { type: 'page', url, platform: platform.name })
  const note = platform.generic ? ' (plateforme non optimisée — surveillance basique)' : ''
  await ctx.reply(`⏳ Veille #${watch.id} créée sur ${platform.name}${note}. Je lis la page…`)

  try {
    const { status, title } = await checkUrl(url)
    await setWatchStatus(watch.id, status)
    await ctx.reply(
      `✅ Surveillance active — <b>${escHtml(title)}</b>\n📊 Statut actuel : ${STATUS_LABEL[status]}\n\nJe t’alerte dès que ça passe en vente.`,
      { parse_mode: 'HTML', reply_markup: pageKeyboard(watch) }
    )
  } catch (err) {
    await ctx.reply(
      `Veille #${watch.id} créée, mais lecture impossible pour l’instant (${err.message}). Je réessaie au prochain cycle.`
    )
  }
}

// ─────────── Gestion ───────────
bot.command('list', async (ctx) => {
  const watches = listWatches(ctx.chat.id)
  if (watches.length === 0) {
    return ctx.reply('Aucune veille. Ajoutes-en une avec /watch <artiste> ou /watch <lien>.')
  }
  const lines = watches.map((w) =>
    w.type === 'page'
      ? `#${w.id} — 🌐 ${w.platform} — ${STATUS_LABEL[w.lastStatus] ?? '⚪ —'}`
      : `#${w.id} — 🔎 ${w.keyword} (international)`
  )
  await ctx.reply(`🎯 Tes veilles :\n${lines.join('\n')}`)
})

bot.command('unwatch', async (ctx) => {
  const id = Number(ctx.match?.trim())
  if (!id) return ctx.reply('Usage : /unwatch <id>  (voir /list)')
  const ok = await removeWatch(ctx.chat.id, id)
  await ctx.reply(ok ? `🗑️ Veille #${id} supprimée.` : `Veille #${id} introuvable.`)
})

bot.command('check', async (ctx) => {
  await ctx.reply('🔎 Vérification en cours…')
  const { runWatchCycle } = await import('./watcher.js') // import dynamique = pas de cycle d'import
  await runWatchCycle()
  await ctx.reply('✅ Terminé.')
})

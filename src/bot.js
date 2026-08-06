import { Bot } from 'grammy'
import { config, isAllowedChat } from './config.js'
import { db, addSubscriber, addWatch, listWatches, removeWatch } from './db.js'
import { searchEvents } from './ticketmaster.js'
import { evaluateEvent, eventSummary, eventKeyboard } from './events.js'

export const bot = new Bot(config.telegramToken)

// /whoami : donne l'ID du chat (pour remplir ALLOWED_CHAT_IDS). Accessible à tous.
bot.command('whoami', (ctx) =>
  ctx.reply(`🪪 Ton ID Telegram : <code>${ctx.chat.id}</code>`, { parse_mode: 'HTML' })
)

// Garde d'accès : si une liste blanche est définie, on ignore les autres comptes.
// (La même garde est appliquée à l'envoi — voir isAllowedChat.)
bot.use(async (ctx, next) => {
  const chatId = ctx.chat?.id
  if (!isAllowedChat(chatId)) {
    await ctx.reply('⛔ Accès restreint à cet assistant.').catch(() => {})
    return
  }
  if (config.allowedChatIds.length === 0 && chatId) {
    console.log(`👤 chat ${chatId} — ${ctx.from?.first_name ?? ''} @${ctx.from?.username ?? ''}`)
  }
  return next()
})

const HELP = [
  '🎟️ <b>Roméo Bot</b> — veille billetterie',
  '',
  "Je te préviens dès qu'un event ouvre à la vente. L'achat reste un clic humain.",
  '',
  '<b>Suivre un artiste</b>',
  '• /watch &lt;artiste&gt; — veille mondiale via l’API Ticketmaster',
  '   ex : <code>/watch Coldplay</code>',
  '',
  '<b>Pour la France</b>',
  'L’API ne couvre pas la France. Crée l’alerte directement sur le site de la',
  'billetterie (Ticketmaster.fr, Fnac…) avec l’adresse mail dédiée : je relaie',
  'le mail ici, avec le lien, dès qu’il arrive.',
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
  if (!arg) return ctx.reply('Usage : /watch <artiste>   ex : /watch Coldplay')

  // Les billetteries FR (Ticketmaster.fr, Fnac) sont derrière un anti-bot : on ne
  // lit pas leurs pages. L'alerte officielle du site + le relais email font le job.
  if (/^https?:\/\//i.test(arg)) {
    return ctx.reply(
      [
        'ℹ️ Je ne surveille pas les pages web.',
        '',
        'Pour un event français : clique « Créer une alerte » sur la page de la billetterie',
        'avec l’adresse mail dédiée. Dès que le mail arrive, je te le relaie ici avec le lien.',
        '',
        'Pour un artiste : /watch <nom de l’artiste>.',
      ].join('\n')
    )
  }

  await addSubscriber(ctx.chat.id)
  return addTmWatch(ctx, arg)
})

// ─────────── Veille mondiale (API Ticketmaster) ───────────
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
      `✅ Veille #${watch.id} créée pour « ${keyword} ». Aucun event listé pour l'instant — je te préviens dès qu'il y en a.`
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

// ─────────── Gestion ───────────
bot.command('list', async (ctx) => {
  const watches = listWatches(ctx.chat.id)
  if (watches.length === 0) {
    return ctx.reply('Aucune veille. Ajoutes-en une avec /watch <artiste>.')
  }
  const lines = watches.map((w) => `#${w.id} — 🔎 ${w.keyword ?? '(veille obsolète)'}`)
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
  const done = await runWatchCycle()
  await ctx.reply(done ? '✅ Terminé.' : 'ℹ️ Un cycle était déjà en cours — tu auras les alertes dans quelques secondes.')
})

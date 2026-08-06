import { bot } from './bot.js'
import { alertRecipients } from './db.js'
import { config } from './config.js'
import { startWatcher } from './watcher.js'
import { emailConfigured, startEmailWatch } from './email.js'
import { emailAlert } from './events.js'

async function main() {
  bot.catch((err) => console.error('Erreur bot :', err))

  const timer = startWatcher()

  // Veille email (optionnelle) : relaie chaque alerte reçue aux abonnés autorisés.
  // Une panne de mail ne doit jamais empêcher le bot Telegram de tourner.
  let stopEmail = null
  if (emailConfigured()) {
    try {
      stopEmail = await startEmailWatch(async ({ subject, from, url }) => {
        const { text, keyboard } = emailAlert({ subject, from, url })
        for (const chatId of alertRecipients()) {
          await bot.api
            .sendMessage(chatId, text, { parse_mode: 'HTML', reply_markup: keyboard })
            .catch((e) => console.error('[email→tg]', e.message))
        }
      })
    } catch (err) {
      console.error('📧 Veille email indisponible, le bot continue sans :', err.message)
    }
  } else {
    console.log('📧 Veille email désactivée (IMAP non configuré dans .env).')
  }

  if (config.allowedChatIds.length === 0) {
    console.warn(
      '⚠️  ALLOWED_CHAT_IDS est vide : n\'importe qui trouvant le bot peut s\'abonner et recevoir tes alertes. Remplis-le dès que possible.'
    )
  }

  const shutdown = async () => {
    console.log('\n⏹️  Arrêt en cours…')
    clearInterval(timer)
    if (stopEmail) await stopEmail()
    await bot.stop()
    process.exit(0)
  }
  process.once('SIGINT', shutdown)
  process.once('SIGTERM', shutdown)

  console.log('🤖 Roméo Bot démarre… (Ctrl+C pour arrêter)')
  await bot.start({
    onStart: (me) => console.log(`✅ Connecté en tant que @${me.username}`),
  })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

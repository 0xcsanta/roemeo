import { bot } from './bot.js'
import { db } from './db.js'
import { startWatcher } from './watcher.js'
import { closeBrowser } from './browser.js'
import { emailConfigured, startEmailWatch } from './email.js'
import { emailAlert } from './events.js'

async function main() {
  bot.catch((err) => console.error('Erreur bot :', err))

  const timer = startWatcher()

  // Veille email (optionnelle) : relaie chaque alerte reçue à tous les abonnés.
  let stopEmail = null
  if (emailConfigured()) {
    stopEmail = await startEmailWatch(async ({ subject, from, url }) => {
      const { text, keyboard } = emailAlert({ subject, from, url })
      for (const chatId of db.data.subscribers) {
        await bot.api
          .sendMessage(chatId, text, { parse_mode: 'HTML', reply_markup: keyboard })
          .catch((e) => console.error('[email→tg]', e.message))
      }
    })
  } else {
    console.log('📧 Veille email désactivée (IMAP non configuré dans .env).')
  }

  const shutdown = async () => {
    console.log('\n⏹️  Arrêt en cours…')
    clearInterval(timer)
    if (stopEmail) await stopEmail()
    await closeBrowser()
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

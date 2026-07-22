import 'dotenv/config'

function required(name) {
  const value = process.env[name]
  if (!value) {
    console.error(`❌ Variable d'environnement manquante : ${name}`)
    console.error('   → Copie .env.example en .env et remplis les valeurs.')
    process.exit(1)
  }
  return value
}

export const config = {
  telegramToken: required('TELEGRAM_BOT_TOKEN'),
  ticketmasterKey: required('TICKETMASTER_API_KEY'),
  countryCode: process.env.TM_COUNTRY_CODE || 'FR',
  pollIntervalMs: (Number(process.env.POLL_INTERVAL_MINUTES) || 10) * 60_000,
  onsaleSoonMs: (Number(process.env.ONSALE_SOON_HOURS) || 24) * 3_600_000,
  pageTimeoutMs: (Number(process.env.PAGE_TIMEOUT_SECONDS) || 30) * 1_000,
  // HEADLESS=false ouvre une vraie fenêtre → bien moins bloqué par les anti-bot.
  headless: (process.env.HEADLESS ?? 'true').toLowerCase() !== 'false',
  // Restriction d'accès : IDs Telegram autorisés (séparés par virgule). Vide = ouvert à tous.
  allowedChatIds: (process.env.ALLOWED_CHAT_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number),
  // Surveillance de pages (Playwright). Mettre false sur un serveur sans écran.
  pageWatchEnabled: (process.env.PAGE_WATCH_ENABLED ?? 'true').toLowerCase() !== 'false',
  // Veille email (optionnelle) : relaie les alertes billetterie reçues par mail.
  imap: {
    host: process.env.IMAP_HOST || '',
    port: Number(process.env.IMAP_PORT) || 993,
    user: process.env.IMAP_USER || '',
    pass: process.env.IMAP_PASSWORD || '',
    pollMs: (Number(process.env.EMAIL_POLL_SECONDS) || 60) * 1_000,
  },
}

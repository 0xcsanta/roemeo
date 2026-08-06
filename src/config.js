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
  // Pays de la recherche TM. VIDE = monde entier — c'est le réglage utile :
  // l'API ne couvre quasiment pas la France (1 event FR contre des milliers au UK).
  countryCode: (process.env.TM_COUNTRY_CODE ?? '').trim(),
  pollIntervalMs: (Number(process.env.POLL_INTERVAL_MINUTES) || 10) * 60_000,
  onsaleSoonMs: (Number(process.env.ONSALE_SOON_HOURS) || 24) * 3_600_000,
  // Restriction d'accès : IDs Telegram autorisés (séparés par virgule). Vide = ouvert à tous.
  allowedChatIds: (process.env.ALLOWED_CHAT_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number),
  // Veille email (optionnelle) : relaie les alertes billetterie reçues par mail.
  imap: {
    host: process.env.IMAP_HOST || '',
    port: Number(process.env.IMAP_PORT) || 993,
    user: process.env.IMAP_USER || '',
    pass: process.env.IMAP_PASSWORD || '',
    pollMs: (Number(process.env.EMAIL_POLL_SECONDS) || 60) * 1_000,
  },
}

/**
 * Liste blanche. S'applique dans les DEUX sens : commandes reçues, mais aussi
 * messages envoyés — sinon un inconnu abonné avant le verrouillage continuerait
 * de recevoir les alertes (dont le contenu des mails) pour toujours.
 * Liste vide = ouvert à tous (mode mise au point).
 */
export function isAllowedChat(chatId) {
  if (config.allowedChatIds.length === 0) return true
  return config.allowedChatIds.includes(Number(chatId))
}

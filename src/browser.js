import { config } from './config.js'

// Navigateur unique, partagé entre toutes les vérifications de pages.
// Playwright est importé dynamiquement : inutile sur un serveur où la
// surveillance de page est désactivée (il peut même ne pas être installé).
let browser = null
let context = null
let chromium = null

export async function getContext() {
  if (context) return context

  if (!chromium) {
    try {
      ;({ chromium } = await import('playwright'))
    } catch {
      throw new Error("Playwright n'est pas installé (surveillance de page indisponible sur ce serveur).")
    }
  }

  browser = await chromium.launch({
    headless: config.headless,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-http2', // corrige ERR_HTTP2_PROTOCOL_ERROR (ex : Fnac)
    ],
  })

  context = await browser.newContext({
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1366, height: 900 },
  })

  // Léger camouflage : masque navigator.webdriver (réduit la détection basique).
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
  })

  return context
}

export async function closeBrowser() {
  try {
    await context?.close()
  } catch {}
  try {
    await browser?.close()
  } catch {}
  context = null
  browser = null
}

import { getContext } from './browser.js'
import { detectPlatform, classify, isBlocked } from './platforms.js'
import { config } from './config.js'

/**
 * Charge une page de billetterie et en déduit le statut de vente.
 * Lecture seule : on lit le texte affiché, on n'interagit avec rien.
 * Statuts : 'onsale' | 'soon' | 'soldout' | 'unknown' | 'blocked'.
 */
export async function checkUrl(rawUrl) {
  const platform = detectPlatform(rawUrl)
  if (!platform) throw new Error('URL invalide')

  const ctx = await getContext()
  const page = await ctx.newPage()
  try {
    await page.goto(rawUrl, { waitUntil: 'domcontentloaded', timeout: config.pageTimeoutMs })
    // Laisse le JS afficher le statut (billetteries très dynamiques).
    await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => {})

    const title = (await page.title()) || ''
    let text = ''
    try {
      text = await page.innerText('body')
    } catch {
      text = ''
    }

    if (isBlocked(title, text)) {
      return { platform, status: 'blocked', title: title || rawUrl }
    }
    const status = classify(platform, `${title}\n${text}`)
    return { platform, status, title: title || rawUrl }
  } finally {
    await page.close().catch(() => {})
  }
}

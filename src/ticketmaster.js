import { config } from './config.js'

const BASE = 'https://app.ticketmaster.com/discovery/v2/events.json'

/**
 * Recherche d'événements via l'API officielle Ticketmaster Discovery.
 * Doc : https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/
 *
 * Lecture seule : on récupère les events, leurs dates et l'heure d'ouverture
 * des ventes (`sales.public.startDateTime`). Aucun achat n'est automatisé.
 */
export async function searchEvents(keyword, { size = 50 } = {}) {
  const params = new URLSearchParams({
    apikey: config.ticketmasterKey,
    keyword,
    size: String(size),
    sort: 'date,asc',
  })
  // Sans countryCode, l'API cherche dans le monde entier (voir config.countryCode).
  if (config.countryCode) params.set('countryCode', config.countryCode)

  const res = await fetch(`${BASE}?${params}`, { signal: AbortSignal.timeout(15_000) })

  if (res.status === 429) {
    throw new Error('Rate limit Ticketmaster atteint (429) — augmente POLL_INTERVAL_MINUTES.')
  }
  if (!res.ok) {
    throw new Error(`Ticketmaster a répondu ${res.status} : ${await res.text()}`)
  }

  const data = await res.json()
  return data._embedded?.events ?? []
}

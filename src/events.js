import { InlineKeyboard } from 'grammy'
import { config } from './config.js'

const dtf = new Intl.DateTimeFormat('fr-FR', {
  timeZone: 'Europe/Paris',
  dateStyle: 'full',
  timeStyle: 'short',
})

export function escHtml(s = '') {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function fmtDate(iso, localDate) {
  if (iso) return dtf.format(new Date(iso))
  if (localDate) return localDate
  return 'date à confirmer'
}

// ─────────────────────────────── Veilles Ticketmaster (API) ───────────────────────────────

/** Texte HTML récapitulatif d'un event de l'API (parse_mode: 'HTML'). */
export function eventSummary(ev) {
  const venue = ev._embedded?.venues?.[0]
  const place = venue ? `${venue.name}${venue.city?.name ? ', ' + venue.city.name : ''}` : null
  const when = fmtDate(ev.dates?.start?.dateTime, ev.dates?.start?.localDate)
  const onsale = ev.sales?.public?.startDateTime
  const price = ev.priceRanges?.[0]

  const lines = [`🎟️ <b>${escHtml(ev.name)}</b>`, `📅 ${escHtml(when)}`]
  if (place) lines.push(`📍 ${escHtml(place)}`)
  if (onsale) lines.push(`🛒 Ouverture des ventes : ${escHtml(dtf.format(new Date(onsale)))}`)
  if (price) lines.push(`💶 ${escHtml(price.min)}–${escHtml(price.max)} ${escHtml(price.currency)}`)
  return lines.join('\n')
}

/** Bouton lien direct vers la page d'achat officielle. */
export function eventKeyboard(ev) {
  return new InlineKeyboard().url('🔗 Voir / acheter', ev.url)
}

/**
 * Met à jour l'état d'un event et retourne la liste des alertes à envoyer.
 * `state` est muté en place. En mode `silent`, on pose l'état sans rien signaler
 * (baseline à l'ajout d'une veille, pour ne pas spammer l'existant).
 */
export function evaluateEvent(ev, state, { silent = false } = {}) {
  const alerts = []
  const onsaleIso = ev.sales?.public?.startDateTime
  const t = onsaleIso ? Date.parse(onsaleIso) : NaN
  const now = Date.now()

  if (!state.new) {
    state.new = true
    if (!silent) alerts.push('new')
  }

  if (!Number.isNaN(t)) {
    if (now >= t) {
      if (!state.onsale) {
        state.onsale = true
        state.soon = true
        if (!silent) alerts.push('onsale')
      }
    } else if (t - now <= config.onsaleSoonMs) {
      if (!state.soon) {
        state.soon = true
        if (!silent) alerts.push('soon')
      }
    }
  }

  return alerts
}

// ─────────────────────────────── Veilles de pages FR (Playwright) ───────────────────────────────

export const STATUS_LABEL = {
  onsale: '🟢 En vente',
  soon: '🟡 Bientôt en vente',
  soldout: '🔴 Complet',
  cancelled: '⛔ Événement annulé',
  unknown: '⚪ Statut à confirmer',
  blocked: '🚧 Lecture bloquée (anti-bot)',
}

export function pageKeyboard(watch) {
  return new InlineKeyboard().url('🔗 Ouvrir la page', watch.url)
}

// ─────────────────────────────── Alertes email relayées ───────────────────────────────

/** Construit le message Telegram pour une alerte billetterie reçue par email. */
export function emailAlert({ subject, from, url }) {
  const text = [
    '📧 <b>Alerte billetterie (email)</b>',
    '',
    escHtml(subject),
    `<i>de ${escHtml(from)}</i>`,
  ].join('\n')
  const keyboard = url ? new InlineKeyboard().url('🔗 Ouvrir', url) : undefined
  return { text, keyboard }
}

/** Message d'alerte pour une veille de page (changement de statut). */
export function pageAlert(watch, status, title, fromSoldout = false) {
  const head =
    status === 'onsale'
      ? fromSoldout
        ? '🔥 Une place vient de réapparaître — go !'
        : '🚨 C’EST EN VENTE — go !'
      : `ℹ️ Changement de statut : ${STATUS_LABEL[status]}`

  return [
    head,
    '',
    `🎟️ <b>${escHtml(title)}</b>`,
    `🏷️ ${escHtml(watch.platform)}`,
    `📊 ${STATUS_LABEL[status] ?? status}`,
  ].join('\n')
}

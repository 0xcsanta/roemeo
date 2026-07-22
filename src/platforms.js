// Détection de la plateforme + classification du statut de vente à partir du
// texte de la page. Approche par mots-clés (résiliente aux changements de DOM).

const norm = (s = '') =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // retire les accents
    .toLowerCase()

// Vocabulaire des billetteries FR. Calibré sur le vrai texte de Ticketmaster.fr :
// le CTA d'achat s'appelle « Choix des places sur plan » / « Choix par tarif »
// (et surtout PAS « panier »/« billet », qui sont dans le menu de toutes les pages).
const FR = {
  cancelled: ['evenement annule', 'spectacle annule', 'representation annulee', 'concert annule'],
  soon: [
    'mise en vente',
    'ouverture des ventes',
    'prochainement',
    'bientot disponible',
    'en vente le',
    'prevente',
  ],
  soldout: [
    'victime de son succes',
    'complet',
    'epuise',
    'plus de disponibilite',
    'plus disponible',
    'indisponible',
    'sold out',
  ],
  onsale: [
    'choix des places',
    'choix par tarif',
    'choisir mes places',
    'ajouter au panier',
    'reserver',
    "j'achete",
    'prendre mes places',
  ],
}

const PLATFORMS = [
  {
    id: 'ticketmaster-fr',
    name: 'Ticketmaster.fr',
    test: (u) => /(^|\.)ticketmaster\.fr$/.test(u.hostname),
    patterns: FR,
  },
  {
    id: 'fnac',
    name: 'Fnac Spectacles',
    test: (u) => /(fnacspectacles|fnactickets)\.com$/.test(u.hostname),
    patterns: FR,
  },
]

/** Retourne la plateforme reconnue, un fallback générique, ou null si l'URL est invalide. */
export function detectPlatform(rawUrl) {
  let u
  try {
    u = new URL(rawUrl)
  } catch {
    return null
  }
  if (!/^https?:$/.test(u.protocol)) return null
  return (
    PLATFORMS.find((p) => p.test(u)) ?? {
      id: 'generic',
      name: u.hostname,
      patterns: FR,
      generic: true,
    }
  )
}

/** Classe le statut : 'onsale' | 'soon' | 'soldout' | 'unknown'. */
export function classify(platform, text) {
  const t = norm(text)
  const has = (arr) => arr.some((k) => t.includes(k))
  const p = platform.patterns

  if (p.cancelled && has(p.cancelled)) return 'cancelled'
  // "Mise en vente le…" prime : c'est un pré-vente, pas encore achetable.
  if (has(p.soon) && !has(p.onsale)) return 'soon'
  if (has(p.soldout)) return 'soldout'
  if (has(p.onsale)) return 'onsale'
  return 'unknown'
}

const BLOCK_MARKERS = [
  'datadome',
  'verifying you are human',
  'are you a robot',
  'captcha',
  'access denied',
  'pardon the interruption',
  'request unsuccessful',
  'detection de robot',
  'verification de securite',
]

/** Détecte une page d'anti-bot / challenge (ou une page quasi vide = échec de lecture). */
export function isBlocked(title, text) {
  const t = norm(`${title}\n${text}`).replace(/\s+/g, ' ').trim()
  if (t.length < 30) return true
  return BLOCK_MARKERS.some((k) => t.includes(k))
}

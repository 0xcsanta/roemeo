import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { JSONFilePreset } from 'lowdb/node'
import { isAllowedChat } from './config.js'

// Petite base locale en JSON (db.json). Zéro dépendance native → tourne partout.
const defaultData = {
  subscribers: [], // [chatId, ...]
  watches: [], // voir plus bas (deux types de veille)
  seen: {}, // veilles TM : "<chatId>:<eventId>" -> { new, soon, onsale }
  meta: { nextWatchId: 1, lastEmailUid: null },
}

// Un "watch" : { id, chatId, type: 'tm', keyword, createdAt }
// (les anciennes veilles type: 'page' d'une base existante sont simplement ignorées)
// Chemin ancré sur le dossier du projet, PAS sur le répertoire courant : sinon un
// lancement depuis ailleurs (`node ~/roemeo/src/index.js`) crée une base vide et
// toutes les veilles semblent avoir disparu.
const dbPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'db.json')

export const db = await JSONFilePreset(dbPath, defaultData)

/** Abonnés autorisés à recevoir une alerte (la liste blanche vaut aussi en sortie). */
export function alertRecipients() {
  return db.data.subscribers.filter((chatId) => isAllowedChat(chatId))
}

export async function addSubscriber(chatId) {
  if (!db.data.subscribers.includes(chatId)) {
    db.data.subscribers.push(chatId)
    await db.write()
  }
}

export async function addWatch(chatId, data) {
  const id = db.data.meta.nextWatchId++
  const watch = { id, chatId, createdAt: new Date().toISOString(), ...data }
  db.data.watches.push(watch)
  await db.write()
  return watch
}

export function listWatches(chatId) {
  return db.data.watches.filter((w) => w.chatId === chatId)
}

export async function removeWatch(chatId, id) {
  const before = db.data.watches.length
  db.data.watches = db.data.watches.filter((w) => !(w.chatId === chatId && w.id === id))
  const removed = db.data.watches.length < before
  if (removed) await db.write()
  return removed
}

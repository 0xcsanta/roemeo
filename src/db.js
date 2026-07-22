import { JSONFilePreset } from 'lowdb/node'

// Petite base locale en JSON (db.json). Zéro dépendance native → tourne partout.
const defaultData = {
  subscribers: [], // [chatId, ...]
  watches: [], // voir plus bas (deux types de veille)
  seen: {}, // veilles TM : "<chatId>:<eventId>" -> { new, soon, onsale }
  meta: { nextWatchId: 1, lastEmailUid: null },
}

// Un "watch" est de l'un des deux types :
//   { id, chatId, type: 'tm',   keyword,               createdAt }
//   { id, chatId, type: 'page', url, platform, lastStatus?, createdAt }
export const db = await JSONFilePreset('db.json', defaultData)

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

export async function setWatchStatus(id, status) {
  const w = db.data.watches.find((x) => x.id === id)
  if (w) {
    w.lastStatus = status
    await db.write()
  }
}

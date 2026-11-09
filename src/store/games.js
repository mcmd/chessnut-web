import { createStore, del, get, set, values } from 'idb-keyval'
import { autoResult, playRecord } from '../chess/pgn.js'
import { reconstruct } from '../chess/positions.js'

let store
const db = () => (store ??= createStore('chessnut-web', 'games'))

const pad = (n) => String(n).padStart(2, '0')

export const pgnDate = (d) => `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`

async function sha256hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

function makeRecord({ id, source, placements, startFen, sans, complete, sortKey }) {
  const now = new Date()
  return {
    id,
    source,
    placements,
    startFen,
    sans,
    complete,
    headers: {
      Event: source === 'live' ? 'Chessnut Air live game' : 'Chessnut Air game',
      Site: 'Chessnut Air',
      Date: pgnDate(now),
      Round: '?',
      White: '?',
      Black: '?',
      Result: autoResult(playRecord({ startFen, sans })),
    },
    sortKey,
    createdAt: now.toISOString(),
  }
}

/** Library record for a game read from the board; the id is stable for identical position lists. */
export async function boardRecord(placements, sortKey) {
  const id = 'board-' + (await sha256hex(placements.join(';')))
  return makeRecord({ id, source: 'board', placements, ...reconstruct(placements), sortKey })
}

export function liveRecord({ startFen, sans, placements }) {
  const id = 'live-' + crypto.randomUUID()
  return makeRecord({ id, source: 'live', placements, startFen, sans, complete: true, sortKey: Date.now() })
}

export async function listGames() {
  const all = await values(db())
  return all.sort((a, b) => b.sortKey - a.sortKey)
}

/** 'duplicate' when a game with this id is already stored; the stored copy is kept. */
export async function saveGame(record) {
  if (await get(record.id, db())) return 'duplicate'
  await set(record.id, record, db())
  return 'saved'
}

export async function updateHeaders(id, headers) {
  const record = await get(id, db())
  if (!record) return null
  const updated = { ...record, headers: { ...record.headers, ...headers } }
  await set(id, updated, db())
  return updated
}

export function deleteGame(id) {
  return del(id, db())
}

export async function requestPersistence() {
  return (await navigator.storage?.persist?.()) ?? false
}

export async function isPersisted() {
  return (await navigator.storage?.persisted?.()) ?? false
}

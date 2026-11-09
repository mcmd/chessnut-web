import { Chess } from 'chess.js'

const HEADER_ORDER = ['Event', 'Site', 'Date', 'Round', 'White', 'Black', 'Result']

/** Chess instance at the end of a recorded game (standard start when startFen is null). */
export function playRecord(record) {
  const chess = record.startFen ? new Chess(record.startFen) : new Chess()
  for (const san of record.sans) chess.move(san)
  return chess
}

export function buildPgn(record) {
  const chess = playRecord(record)
  for (const key of HEADER_ORDER) chess.setHeader(key, record.headers[key] ?? '?')
  const pgn = chess.pgn()
  // chess.js drops the blank line between tags and movetext when there are no moves.
  return record.sans.length ? pgn : pgn.replace(/\n ?(\S+)$/, '\n\n$1')
}

export function autoResult(chess) {
  if (chess.isCheckmate()) return chess.turn() === 'w' ? '0-1' : '1-0'
  if (chess.isDraw()) return '1/2-1/2'
  return '*'
}

import { Chess } from 'chess.js'

export const STANDARD_PLACEMENT = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR'

/** Map of square name → piece letter for a FEN placement field. */
export function squareMap(placement) {
  const map = {}
  placement.split('/').forEach((rank, i) => {
    let file = 0
    for (const ch of rank) {
      if (/\d/.test(ch)) {
        file += Number(ch)
      } else {
        map[String.fromCharCode(97 + file) + (8 - i)] = ch
        file++
      }
    }
  })
  return map
}

/** Full FEN from a placement; castling rights only where king and rook stand on home squares. */
export function fenFromPlacement(placement, turn) {
  const m = squareMap(placement)
  let castling = ''
  if (m.e1 === 'K' && m.h1 === 'R') castling += 'K'
  if (m.e1 === 'K' && m.a1 === 'R') castling += 'Q'
  if (m.e8 === 'k' && m.h8 === 'r') castling += 'k'
  if (m.e8 === 'k' && m.a8 === 'r') castling += 'q'
  return `${placement} ${turn} ${castling || '-'} - 0 1`
}

export function tryLoad(placement, turn) {
  try {
    return new Chess(fenFromPlacement(placement, turn))
  } catch {
    return null
  }
}

export const placementOf = (chess) => chess.fen().split(' ')[0]

/** The legal move in `chess` that produces `placement`, or null. */
export function findMove(chess, placement) {
  for (const move of chess.moves({ verbose: true })) {
    chess.move({ from: move.from, to: move.to, promotion: move.promotion })
    const hit = placementOf(chess) === placement
    chess.undo()
    if (hit) return move
  }
  return null
}

function replay(placements, start, turn) {
  const chess = tryLoad(placements[start], turn)
  if (!chess) return null
  const startFen = chess.fen()
  for (const p of placements.slice(start + 1)) {
    const move = findMove(chess, p)
    if (move) chess.move({ from: move.from, to: move.to, promotion: move.promotion })
  }
  return {
    startFen,
    sans: chess.history(),
    complete: placementOf(chess) === placements[placements.length - 1],
  }
}

/** Rebuild a game from recorded placements, skipping those that are not a legal move away. */
export function reconstruct(placements) {
  const start = placements.findIndex((p) => tryLoad(p, 'w') || tryLoad(p, 'b'))
  if (start < 0) return { startFen: null, sans: [], complete: false }
  const white = replay(placements, start, 'w')
  const black = replay(placements, start, 'b')
  if (!black) return white
  if (!white) return black
  return black.sans.length > white.sans.length ? black : white
}

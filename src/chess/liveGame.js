import { findMove, placementOf, squareMap, tryLoad } from './positions.js'

/** Start tracking a live game; null when the position is not a legal start. */
export function createLiveGame(placement, turn) {
  const chess = tryLoad(placement, turn)
  return chess && { chess, startFen: chess.fen(), placements: [placement] }
}

/**
 * Feed a live board placement into the game.
 * Returns the game's current last move (verbose, or null) and the lifted piece with its legal targets.
 */
export function applyPlacement(game, placement) {
  const { chess, placements } = game
  const current = placementOf(chess)
  let lifted = null

  if (placement !== current) {
    if (placements.length > 1 && placement === placements[placements.length - 2]) {
      chess.undo()
      placements.pop()
    } else {
      const move = findMove(chess, placement)
      if (move) {
        chess.move({ from: move.from, to: move.to, promotion: move.promotion })
        placements.push(placement)
      } else {
        lifted = liftedPiece(chess, current, placement)
      }
    }
  }

  return { game, lastMove: chess.history({ verbose: true }).at(-1) ?? null, lifted }
}

function liftedPiece(chess, current, placement) {
  const before = squareMap(current)
  const after = squareMap(placement)
  const changed = new Set([...Object.keys(before), ...Object.keys(after)].filter((sq) => before[sq] !== after[sq]))
  if (changed.size !== 1) return null
  const [square] = changed
  const piece = before[square]
  if (!piece || after[square]) return null
  const color = piece === piece.toUpperCase() ? 'w' : 'b'
  if (color !== chess.turn()) return null
  return { square, targets: [...new Set(chess.moves({ square, verbose: true }).map((m) => m.to))] }
}

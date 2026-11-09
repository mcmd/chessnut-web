import { describe, expect, it } from 'vitest'
import { applyPlacement, createLiveGame } from './liveGame.js'
import { STANDARD_PLACEMENT } from './positions.js'

describe('live game tracking', () => {
  it('reports lifted pieces, moves and takebacks', () => {
    const game = createLiveGame(STANDARD_PLACEMENT, 'w')

    const lift = applyPlacement(game, 'rnbqkbnr/pppppppp/8/8/8/8/PPPP1PPP/RNBQKBNR')
    expect(lift.lifted).toEqual({ square: 'e2', targets: ['e3', 'e4'] })
    expect(lift.lastMove).toBeNull()

    const move = applyPlacement(game, 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR')
    expect(move.lifted).toBeNull()
    expect([move.lastMove.from, move.lastMove.to]).toEqual(['e2', 'e4'])

    const back = applyPlacement(game, STANDARD_PLACEMENT)
    expect(back.lastMove).toBeNull()
    expect(game.chess.history()).toEqual([])
  })

  it('ignores an opponent piece lifted for a capture', () => {
    const game = createLiveGame(STANDARD_PLACEMENT, 'w')
    expect(applyPlacement(game, 'rnbqkbnr/1ppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR').lifted).toBeNull()
  })

  it('includes castling among king targets', () => {
    const game = createLiveGame('r3k2r/8/8/8/8/8/8/R3K2R', 'w')
    const { lifted } = applyPlacement(game, 'r3k2r/8/8/8/8/8/8/R6R')
    expect(lifted.targets).toEqual(expect.arrayContaining(['g1', 'c1']))
  })
})

import { describe, expect, it } from 'vitest'
import { Chess } from 'chess.js'
import { autoResult, buildPgn, playRecord } from './pgn.js'
import { fenFromPlacement, reconstruct, STANDARD_PLACEMENT } from './positions.js'

const GAME_A = [
  '8/6k1/8/8/8/8/3K4/1Q2Q3',
  '8/6k1/8/8/8/8/3K4/4Q3',
  '8/6k1/1Q6/8/8/8/3K4/4Q3',
  '8/8/1Q6/8/8/8/3K4/4Q3',
  '8/7k/1Q6/8/8/8/3K4/4Q3',
  '8/7k/1Q6/8/8/8/3K4/8',
  '8/4Q2k/1Q6/8/8/8/3K4/8',
  '8/4Q3/1Q6/8/8/8/3K4/8',
  '7k/4Q3/1Q6/8/8/8/3K4/8',
  '7k/4Q3/8/8/8/8/3K4/8',
  '1Q5k/4Q3/8/8/8/8/3K4/8',
]

const GAME_B = [
  '8/8/7k/8/Q7/1Q6/3K4/8',
  '8/8/8/8/Q7/1Q6/3K4/8',
  '8/7k/8/8/Q7/1Q6/3K4/8',
  '8/7k/8/8/Q7/8/3K4/8',
  '8/7k/1Q6/8/Q7/8/3K4/8',
  '8/8/1Q6/8/Q7/8/3K4/8',
  '7k/8/1Q6/8/Q7/8/3K4/8',
  '7k/8/1Q6/8/8/8/3K4/8',
  '4Q2k/8/1Q6/8/8/8/3K4/8',
]

const headers = { Event: 'E', Site: 'S', Date: '2025.01.01', Round: '?', White: '?', Black: '?', Result: '1-0' }

describe('reconstruct', () => {
  it('rebuilds a white-to-move game, skipping lifted-piece frames', () => {
    const game = reconstruct(GAME_A)
    expect(game.sans).toEqual(['Qb6', 'Kh7', 'Qe7+', 'Kh8', 'Qb8#'])
    expect(game.startFen).toBe('8/6k1/8/8/8/8/3K4/1Q2Q3 w - - 0 1')
    expect(game.complete).toBe(true)
    expect(autoResult(playRecord(game))).toBe('1-0')
  })

  it('detects that black moved first', () => {
    const game = reconstruct(GAME_B)
    expect(game.sans).toEqual(['Kh7', 'Qb6', 'Kh8', 'Qe8+'])
    expect(game.startFen).toBe('8/8/7k/8/Q7/1Q6/3K4/8 b - - 0 1')
    expect(autoResult(playRecord(game))).toBe('*')
  })

  it('marks a game incomplete when the last position is unexplained', () => {
    expect(reconstruct([...GAME_A, '8/8/8/8/8/8/3K4/8']).complete).toBe(false)
  })

  it('returns an empty game when no position is loadable', () => {
    expect(reconstruct(['8/8/8/8/8/8/8/8'])).toEqual({ startFen: null, sans: [], complete: false })
  })
})

describe('fenFromPlacement', () => {
  it('grants castling rights only for kings and rooks on home squares', () => {
    expect(fenFromPlacement(STANDARD_PLACEMENT, 'w')).toBe(new Chess().fen())
    expect(fenFromPlacement('r3k3/8/8/8/8/8/8/4K2R', 'b')).toBe('r3k3/8/8/8/8/8/8/4K2R b Kq - 0 1')
  })
})

describe('buildPgn', () => {
  it('includes the setup position for non-standard starts', () => {
    const pgn = buildPgn({ ...reconstruct(GAME_A), headers })
    expect(pgn).toContain('[SetUp "1"]')
    expect(pgn).toContain('[FEN "8/6k1/8/8/8/8/3K4/1Q2Q3 w - - 0 1"]')
    expect(pgn).toContain('3. Qb8# 1-0')
  })

  it('separates tags from movetext with a blank line when there are no moves', () => {
    const pgn = buildPgn({ startFen: '8/8/8/8/8/8/3K4/7k w - - 0 1', sans: [], headers: { ...headers, Result: '*' } })
    expect(pgn).toMatch(/\[FEN "8\/8\/8\/8\/8\/8\/3K4\/7k w - - 0 1"\]\n\n\*$/)
  })
})

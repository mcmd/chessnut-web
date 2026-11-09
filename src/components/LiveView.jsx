import { useEffect, useState } from 'react'
import { Chessboard } from 'react-chessboard'
import { useBoard } from '../ble/BoardContext.jsx'
import { applyPlacement, createLiveGame } from '../chess/liveGame.js'
import { STANDARD_PLACEMENT } from '../chess/positions.js'
import { liveRecord, saveGame } from '../store/games.js'
import MoveList from './MoveList.jsx'

const TOGGLES_KEY = 'chessnut.liveToggles'
const EMPTY_BOARD = '8/8/8/8/8/8/8/8'
const NO_TRACK = { lastMove: null, lifted: null, sans: [] }

function loadToggles() {
  try {
    return { lastMove: false, hints: false, ...JSON.parse(localStorage.getItem(TOGGLES_KEY)) }
  } catch {
    return { lastMove: false, hints: false }
  }
}

function ledSquares(game, track, toggles) {
  if (!game) return []
  if (track.lifted && toggles.hints) return [track.lifted.square, ...track.lifted.targets]
  if (track.lastMove && toggles.lastMove) return [track.lastMove.from, track.lastMove.to]
  return []
}

export default function LiveView({ active }) {
  const { board, status, placement } = useBoard()
  const [orientation, setOrientation] = useState('white')
  const [game, setGame] = useState(null)
  const [choosingTurn, setChoosingTurn] = useState(false)
  const [turn, setTurn] = useState('w')
  const [track, setTrack] = useState(NO_TRACK)
  const [toggles, setToggles] = useState(loadToggles)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    localStorage.setItem(TOGGLES_KEY, JSON.stringify(toggles))
  }, [toggles])

  useEffect(() => {
    if (!game || !placement) return
    const { lastMove, lifted } = applyPlacement(game, placement)
    setTrack({ lastMove, lifted, sans: game.chess.history() })
  }, [game, placement])

  const leds = active ? ledSquares(game, track, toggles).join(',') : ''
  useEffect(() => {
    if (status === 'connected') board.setLeds(leds ? leds.split(',') : [])
  }, [board, status, leds])
  useEffect(() => () => board.setLeds([]), [board])

  const start = (t) => {
    const g = createLiveGame(placement, t)
    if (!g) {
      setMessage('Cannot start here: the position needs exactly one king per side and must be legal.')
      return
    }
    setGame(g)
    setTrack(NO_TRACK)
    setChoosingTurn(false)
    setMessage(null)
  }

  const end = () => {
    setGame(null)
    setTrack(NO_TRACK)
  }

  const save = async () => {
    try {
      await saveGame(liveRecord({ startFen: game.startFen, sans: game.chess.history(), placements: game.placements }))
      end()
      setMessage('Saved to library.')
    } catch (e) {
      setMessage(`Save failed: ${e.message}`)
    }
  }

  const discard = () => {
    if (track.sans.length && !confirm('Discard this game?')) return
    end()
    setMessage(null)
  }

  const squareStyles = {}
  if (track.lastMove) {
    squareStyles[track.lastMove.from] = squareStyles[track.lastMove.to] = { background: 'rgba(255, 210, 0, 0.45)' }
  }
  if (track.lifted) {
    squareStyles[track.lifted.square] = { background: 'rgba(0, 140, 255, 0.45)' }
    for (const sq of track.lifted.targets) {
      squareStyles[sq] = { background: 'radial-gradient(circle, rgba(0, 140, 255, 0.55) 22%, transparent 24%)' }
    }
  }

  const fen = game ? game.chess.fen() : placement
  const toggle = (key) => setToggles((t) => ({ ...t, [key]: !t[key] }))

  return (
    <section hidden={!active}>
      <div className="board">
        <Chessboard
          options={{
            id: 'live',
            position: placement ?? EMPTY_BOARD,
            boardOrientation: orientation,
            allowDragging: false,
            showAnimations: false,
            squareStyles,
          }}
        />
      </div>
      <div className="row">
        <button onClick={() => setOrientation((o) => (o === 'white' ? 'black' : 'white'))}>Flip</button>
        {fen && <button onClick={() => navigator.clipboard.writeText(fen)}>Copy FEN</button>}
      </div>
      {fen && <code className="fen">{fen}</code>}
      {status !== 'connected' && <p className="muted">Connect the board to see the live position.</p>}

      <h2>Game</h2>
      {!game && !choosingTurn && (
        <button disabled={!placement} onClick={() => (placement === STANDARD_PLACEMENT ? start('w') : setChoosingTurn(true))}>
          Start game
        </button>
      )}
      {choosingTurn && (
        <div className="row">
          <label>
            To move{' '}
            <select value={turn} onChange={(e) => setTurn(e.target.value)}>
              <option value="w">White</option>
              <option value="b">Black</option>
            </select>
          </label>
          <button disabled={!placement} onClick={() => start(turn)}>
            Start
          </button>
          <button onClick={() => setChoosingTurn(false)}>Cancel</button>
        </div>
      )}
      {game && (
        <>
          <MoveList sans={track.sans} startFen={game.startFen} />
          <div className="row">
            <button onClick={save}>Save to library</button>
            <button onClick={discard}>Discard</button>
          </div>
        </>
      )}
      {message && <p>{message}</p>}

      <div className="toggles">
        <label>
          <input type="checkbox" disabled={!game} checked={toggles.lastMove} onChange={() => toggle('lastMove')} /> Light
          last move
        </label>
        <label>
          <input type="checkbox" disabled={!game} checked={toggles.hints} onChange={() => toggle('hints')} /> Show moves
          for lifted piece
        </label>
      </div>
    </section>
  )
}

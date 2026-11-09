import { useCallback, useEffect, useState } from 'react'
import { useBoard } from '../ble/BoardContext.jsx'
import { boardRecord, requestPersistence, saveGame } from '../store/games.js'

export default function BoardGames() {
  const { board, status, busy } = useBoard()
  const [count, setCount] = useState(null)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)

  const exclusive = useCallback(
    (fn) => {
      setError(null)
      setMessage(null)
      return board.runExclusive(fn).catch((e) => setError(e.message))
    },
    [board],
  )

  useEffect(() => {
    if (status === 'connected') exclusive(async () => setCount(await board.getGameCount()))
    else setCount(null)
  }, [status, board, exclusive])

  const readNewest = () =>
    exclusive(async () => {
      const placements = await board.readNewestGame()
      const result = await saveGame(await boardRecord(placements, Date.now()))
      setMessage(result === 'saved' ? 'Saved' : 'Already in library')
      setCount(await board.getGameCount())
    })

  const importAll = () =>
    exclusive(async () => {
      const total = await board.getGameCount()
      setCount(total)
      if (total === 0) {
        setMessage('No games on the board.')
        return
      }
      const ok = confirm(
        `Move all ${total} games from the board into this app? Each game is deleted from the board only after it is saved here.`,
      )
      if (!ok) return
      await requestPersistence()
      const batchStart = Date.now()
      let remaining = total
      for (let k = 1; remaining > 0; k++) {
        setMessage(`Importing game ${k} of ${total}`)
        const placements = await board.readNewestGame()
        // Saved or already stored: either way the game is safe in the library before it is deleted.
        await saveGame(await boardRecord(placements, batchStart - (k - 1)))
        await board.deleteNewestGame()
        const next = await board.getGameCount()
        setCount(next)
        if (next !== remaining - 1) {
          throw new Error('Board count did not drop as expected; stopped to protect your games.')
        }
        remaining = next
      }
      setMessage(`Imported ${total} game${total === 1 ? '' : 's'}.`)
    })

  const disabled = status !== 'connected' || busy

  return (
    <section>
      <p>
        Games on board: <strong>{count ?? '—'}</strong>
      </p>
      <p className="muted">
        The board only exposes its newest game. Reading keeps it on the board; importing moves every game into this
        app, newest first.
      </p>
      <div className="row">
        <button disabled={disabled || !count} onClick={readNewest}>
          Read newest (keep on board)
        </button>
        <button disabled={disabled || !count} onClick={importAll}>
          Import all
        </button>
      </div>
      {message && <p>{message}</p>}
      {error && <p className="error">{error}</p>}
      {status !== 'connected' && <p className="muted">Connect the board first.</p>}
    </section>
  )
}

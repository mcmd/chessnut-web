import { useCallback, useEffect, useState } from 'react'
import { buildPgn } from '../chess/pgn.js'
import { bulkFilename, downloadText, downloadZip, gameFilename } from '../export/download.js'
import { deleteGame, isPersisted, listGames } from '../store/games.js'
import GameViewer from './GameViewer.jsx'

export default function Library() {
  const [games, setGames] = useState(null)
  const [openId, setOpenId] = useState(null)
  const [choosingExport, setChoosingExport] = useState(false)
  const [persisted, setPersisted] = useState(true)
  const [error, setError] = useState(null)

  const reload = useCallback(() => listGames().then(setGames, (e) => setError(e.message)), [])

  useEffect(() => {
    reload()
    isPersisted().then(setPersisted)
  }, [reload])

  const open = games?.find((g) => g.id === openId)
  if (open) return <GameViewer record={open} onBack={() => setOpenId(null)} onSaved={reload} />

  const remove = async (game) => {
    if (!confirm('Delete this game from the library?')) return
    await deleteGame(game.id)
    reload()
  }

  const exportAll = (kind) => {
    setChoosingExport(false)
    if (kind === 'pgn') {
      downloadText(bulkFilename('pgn'), games.map(buildPgn).join('\n\n') + '\n')
    } else {
      const files = Object.fromEntries(
        games.map((g, i) => [`${String(i + 1).padStart(3, '0')}-${gameFilename(g)}`, buildPgn(g) + '\n']),
      )
      downloadZip(bulkFilename('zip'), files)
    }
  }

  if (!games) return <section>{error ? <p className="error">{error}</p> : <p className="muted">Loading…</p>}</section>

  return (
    <section>
      {!persisted && games.length > 0 && (
        <p className="notice">Browser may clear this storage — export your games.</p>
      )}
      <div className="row">
        <strong>
          {games.length} game{games.length === 1 ? '' : 's'}
        </strong>
        {games.length > 0 && !choosingExport && <button onClick={() => setChoosingExport(true)}>Export all</button>}
        {choosingExport && (
          <>
            <button onClick={() => exportAll('pgn')}>Single PGN file</button>
            <button onClick={() => exportAll('zip')}>ZIP, one PGN per game</button>
            <button onClick={() => setChoosingExport(false)}>Cancel</button>
          </>
        )}
      </div>
      <ul className="library">
        {games.map((g) => (
          <li key={g.id}>
            <div>
              <div>
                {new Date(g.createdAt).toLocaleString()} · {g.source === 'live' ? 'live' : 'board'}
              </div>
              <div>
                {g.headers.White} – {g.headers.Black} · {Math.ceil(g.sans.length / 2)} moves · {g.headers.Result}
                {!g.complete && <span className="badge">incomplete</span>}
              </div>
            </div>
            <div className="row">
              <button onClick={() => setOpenId(g.id)}>Open</button>
              <button onClick={() => downloadText(gameFilename(g), buildPgn(g) + '\n')}>Download PGN</button>
              <button onClick={() => remove(g)}>Delete</button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

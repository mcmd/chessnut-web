import { useEffect, useMemo, useState } from 'react'
import { Chess } from 'chess.js'
import { Chessboard } from 'react-chessboard'
import { buildPgn } from '../chess/pgn.js'
import { gameFilename, downloadText } from '../export/download.js'
import { updateHeaders } from '../store/games.js'
import MoveList from './MoveList.jsx'

const FIELDS = ['White', 'Black', 'Event', 'Date']
const RESULTS = ['*', '1-0', '0-1', '1/2-1/2']

function positionsOf(record) {
  if (!record.startFen) return [record.placements.at(-1) ?? '8/8/8/8/8/8/8/8']
  const chess = new Chess(record.startFen)
  const fens = [chess.fen()]
  for (const san of record.sans) {
    chess.move(san)
    fens.push(chess.fen())
  }
  return fens
}

export default function GameViewer({ record, onBack, onSaved }) {
  const fens = useMemo(() => positionsOf(record), [record])
  const [ply, setPly] = useState(fens.length - 1)
  const [orientation, setOrientation] = useState('white')
  const [headers, setHeaders] = useState(record.headers)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.('input, select, textarea')) return
      if (e.key === 'ArrowLeft') setPly((p) => Math.max(0, p - 1))
      if (e.key === 'ArrowRight') setPly((p) => Math.min(fens.length - 1, p + 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fens])

  const edit = (key, value) => {
    setSaved(false)
    setHeaders((h) => ({ ...h, [key]: value }))
  }

  const save = async () => {
    await updateHeaders(record.id, headers)
    setSaved(true)
    onSaved()
  }

  return (
    <section>
      <button onClick={onBack}>◀ Library</button>
      {!record.complete && (
        <p className="notice">
          Some recorded positions could not be matched to legal moves; the raw positions are kept.
        </p>
      )}
      <div className="board">
        <Chessboard
          options={{ id: 'viewer', position: fens[ply], boardOrientation: orientation, allowDragging: false }}
        />
      </div>
      <div className="row">
        <button disabled={ply === 0} onClick={() => setPly(ply - 1)}>
          ◀
        </button>
        <button disabled={ply === fens.length - 1} onClick={() => setPly(ply + 1)}>
          ▶
        </button>
        <button onClick={() => setOrientation((o) => (o === 'white' ? 'black' : 'white'))}>Flip</button>
      </div>
      <MoveList sans={record.sans} startFen={record.startFen} current={ply} onSelect={setPly} />
      <div className="fields">
        {FIELDS.map((key) => (
          <label key={key}>
            {key}
            <input value={headers[key]} onChange={(e) => edit(key, e.target.value)} />
          </label>
        ))}
        <label>
          Result
          <select value={headers.Result} onChange={(e) => edit('Result', e.target.value)}>
            {RESULTS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="row">
        <button onClick={save}>{saved ? 'Saved' : 'Save details'}</button>
        <button onClick={() => downloadText(gameFilename(record), buildPgn({ ...record, headers }) + '\n')}>
          Download PGN
        </button>
      </div>
    </section>
  )
}

import { useEffect, useState } from 'react'
import { useBoard } from '../ble/BoardContext.jsx'

const MAX_ENTRIES = 300

const pad = (n, w = 2) => String(n).padStart(w, '0')

function formatEntry({ t, dir, hex }) {
  const d = new Date(t)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)} ${dir.padEnd(4)} ${hex}`
}

export default function ProtocolLog() {
  const { board } = useBoard()
  const [entries, setEntries] = useState([])

  useEffect(() => {
    const onLog = (e) => setEntries((list) => [...list.slice(-(MAX_ENTRIES - 1)), formatEntry(e.detail)])
    board.addEventListener('log', onLog)
    return () => board.removeEventListener('log', onLog)
  }, [board])

  return (
    <details className="log">
      <summary>Protocol log ({entries.length})</summary>
      <div className="row">
        <button onClick={() => navigator.clipboard.writeText(entries.join('\n'))}>Copy all</button>
        <button onClick={() => setEntries([])}>Clear</button>
      </div>
      <pre>{entries.join('\n')}</pre>
    </details>
  )
}

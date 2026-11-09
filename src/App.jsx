import { useState } from 'react'
import { ChessnutBoard } from './ble/ChessnutBoard.js'
import { BoardProvider } from './ble/BoardContext.jsx'
import BoardGames from './components/BoardGames.jsx'
import ConnectionBar from './components/ConnectionBar.jsx'
import Library from './components/Library.jsx'
import LiveView from './components/LiveView.jsx'
import ProtocolLog from './components/ProtocolLog.jsx'

const TABS = { live: 'Live', board: 'Board games', library: 'Library' }

export default function App() {
  const [board] = useState(() => new ChessnutBoard())
  const [tab, setTab] = useState('live')

  if (!ChessnutBoard.isSupported()) {
    return (
      <main className="app">
        <p className="notice">
          This browser has no Web Bluetooth. Use Chrome on Android, ChromeOS, Windows, macOS or Linux.
        </p>
        <Library />
      </main>
    )
  }

  return (
    <BoardProvider board={board}>
      <main className="app">
        <ConnectionBar />
        <nav className="tabs">
          {Object.entries(TABS).map(([key, label]) => (
            <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
              {label}
            </button>
          ))}
        </nav>
        <LiveView active={tab === 'live'} />
        {tab === 'board' && <BoardGames />}
        {tab === 'library' && <Library />}
        <ProtocolLog />
      </main>
    </BoardProvider>
  )
}

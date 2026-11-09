import { createContext, useContext, useEffect, useState } from 'react'

const BoardContext = createContext(null)

export function BoardProvider({ board, children }) {
  const [status, setStatus] = useState(board.status)
  const [placement, setPlacement] = useState(null)
  const [busy, setBusy] = useState(board.busy)

  useEffect(() => {
    const onStatus = (e) => {
      setStatus(e.detail)
      if (e.detail === 'disconnected') setPlacement(null)
    }
    const onPlacement = (e) => setPlacement(e.detail)
    const onBusy = (e) => setBusy(e.detail)
    board.addEventListener('status', onStatus)
    board.addEventListener('placement', onPlacement)
    board.addEventListener('busy', onBusy)
    return () => {
      board.removeEventListener('status', onStatus)
      board.removeEventListener('placement', onPlacement)
      board.removeEventListener('busy', onBusy)
    }
  }, [board])

  return <BoardContext.Provider value={{ board, status, placement, busy }}>{children}</BoardContext.Provider>
}

// eslint-disable-next-line react/only-export-components
export const useBoard = () => useContext(BoardContext)

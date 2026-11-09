import { useCallback, useEffect, useState } from 'react'
import { useBoard } from '../ble/BoardContext.jsx'

export default function ConnectionBar() {
  const { board, status } = useBoard()
  const [info, setInfo] = useState(null)
  const [error, setError] = useState(null)

  const refreshInfo = useCallback(() => {
    board.runExclusive(() => board.getInfo()).then(setInfo, (e) => setError(e.message))
  }, [board])

  useEffect(() => {
    if (status === 'connected') refreshInfo()
    else setInfo(null)
  }, [status, refreshInfo])

  const run = (fn) => {
    setError(null)
    fn().catch((e) => {
      // NotFoundError: the user closed the device picker.
      if (e.name !== 'NotFoundError') setError(e.message)
    })
  }

  const battery = info?.battery ? `${info.battery.level}%${info.battery.charging ? ' ⚡' : ''}` : '—'
  const versions = [info?.bleVersion && `BLE ${info.bleVersion}`, info?.mcuVersion && `MCU ${info.mcuVersion}`]
  const firmware = versions.filter(Boolean).join(' / ') || '—'

  return (
    <header className="connection">
      <div className="row">
        {status === 'connected' ? (
          <button onClick={() => run(() => board.disconnect())}>Disconnect</button>
        ) : (
          <>
            <button disabled={status === 'connecting'} onClick={() => run(() => board.connect())}>
              {status === 'connecting' ? 'Connecting…' : 'Connect'}
            </button>
            {board.device && status === 'disconnected' && (
              <button onClick={() => run(() => board.reconnect())}>Reconnect</button>
            )}
          </>
        )}
        <span className={`status ${status}`}>{board.deviceName ?? 'No board'} · {status}</span>
      </div>
      {status === 'connected' && (
        <div className="row info">
          <span>Battery {battery}</span>
          <span>Firmware {firmware}</span>
          <button onClick={refreshInfo}>Refresh info</button>
        </div>
      )}
      {error && <p className="error">{error}</p>}
    </header>
  )
}

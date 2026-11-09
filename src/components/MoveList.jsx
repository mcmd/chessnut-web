/** SAN moves numbered from the start position; `current` highlights a ply (1-based), `onSelect` makes moves clickable. */
export default function MoveList({ sans, startFen, current, onSelect }) {
  if (!sans.length) return <p className="muted">No moves yet.</p>
  const blackFirst = startFen?.split(' ')[1] === 'b'
  const firstMoveNumber = Number(startFen?.split(' ')[5] ?? 1)
  return (
    <ol className="moves">
      {sans.map((san, i) => {
        const halfmove = i + (blackFirst ? 1 : 0)
        const number = firstMoveNumber + Math.floor(halfmove / 2)
        const prefix = halfmove % 2 === 0 ? `${number}. ` : i === 0 ? `${number}… ` : ''
        const ply = i + 1
        return (
          <li key={i}>
            {prefix}
            {onSelect ? (
              <button className={`san ${current === ply ? 'current' : ''}`} onClick={() => onSelect(ply)}>
                {san}
              </button>
            ) : (
              san
            )}
          </li>
        )
      })}
    </ol>
  )
}

// Chessnut Air BLE protocol: UUIDs, commands, and pure frame codecs.

export const UUID = {
  cmdService: '1b7e8271-2877-41c3-b46e-cf057c562023',
  cmdWrite: '1b7e8272-2877-41c3-b46e-cf057c562023',
  cmdNotify: '1b7e8273-2877-41c3-b46e-cf057c562023',
  fenService: '1b7e8261-2877-41c3-b46e-cf057c562023',
  fenNotify: '1b7e8262-2877-41c3-b46e-cf057c562023',
  fileService: '1b7e8281-2877-41c3-b46e-cf057c562023',
  fileNotify: '1b7e8283-2877-41c3-b46e-cf057c562023',
}

const bytes = (...b) => Uint8Array.from(b)

export const CMD = {
  realtime: bytes(0x21, 0x01, 0x00),
  uploadMode: bytes(0x21, 0x01, 0x01),
  fileCount: bytes(0x31, 0x01, 0x00),
  startFileRead: bytes(0x33, 0x01, 0x00),
  readNextChunk: bytes(0x34, 0x01, 0x01),
  deleteNewest: bytes(0x39, 0x01, 0x00),
  battery: bytes(0x29, 0x01, 0x00),
  bleVersion: bytes(0x27, 0x01, 0x00),
  mcuVersion: bytes(0x27, 0x01, 0x01),
}

// Index = board piece code; codes above 12 are treated as empty.
const PIECES = ['', 'q', 'k', 'b', 'p', 'n', 'R', 'P', 'r', 'B', 'N', 'Q', 'K']

/** Decode a board frame into the FEN piece-placement field, or null when too short. */
export function decodePlacement(frame) {
  if (frame.length < 32) return null
  const offset = frame.length >= 34 ? 2 : frame.length === 33 ? 1 : 0
  // Squares in board order: h8, g8 … a8, h7 … a1.
  const squares = []
  for (let i = 0; i < 32; i++) {
    const b = frame[offset + i]
    squares.push(PIECES[b & 0x0f] ?? '', PIECES[b >> 4] ?? '')
  }
  const ranks = []
  for (let r = 0; r < 8; r++) {
    // Reverse each rank so it reads a → h.
    const rank = squares.slice(r * 8, r * 8 + 8).reverse()
    let out = ''
    let empty = 0
    for (const p of rank) {
      if (p) {
        if (empty) out += empty
        out += p
        empty = 0
      } else {
        empty++
      }
    }
    if (empty) out += empty
    ranks.push(out)
  }
  return ranks.join('/')
}

/** LED frame lighting the given squares: rank 8 byte first, file a = 0x80 … h = 0x01. */
export function ledFrame(squares) {
  const frame = new Uint8Array(10)
  frame[0] = 0x0a
  frame[1] = 0x08
  for (const sq of squares) {
    if (typeof sq !== 'string' || !/^[a-h][1-8]$/.test(sq)) continue
    const file = sq.charCodeAt(0) - 97
    const rank = Number(sq[1])
    frame[2 + (8 - rank)] |= 0x80 >> file
  }
  return frame
}

export function parseCount(b) {
  return b[0] === 0x32 && b.length >= 3 ? b[2] : null
}

export function parseTransferHeader(b) {
  if (b[0] !== 0x36 || b.length < 4) return null
  return { expectedPositions: (b[2] | (b[3] << 8)) / 38 }
}

export function parseBattery(b) {
  if (b[0] !== 0x2a || b.length < 4) return null
  return { level: Math.min(100, Math.max(0, b[2])), charging: b[3] === 0x01 }
}

export function parseVersion(b) {
  if (b[0] !== 0x28 || b.length < 3) return null
  const end = Math.min(3 + b[1], b.length)
  let s = ''
  for (let i = 3; i < end; i++) if (b[i] !== 0) s += String.fromCharCode(b[i])
  return s
}

export function toHex(b) {
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join(' ')
}

import { strToU8, zipSync } from 'fflate'

const pad = (n) => String(n).padStart(2, '0')

const ymd = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`

export function gameFilename(record) {
  const d = new Date(record.createdAt)
  return `chessnut-${ymd(d)}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.pgn`
}

export const bulkFilename = (ext) => `chessnut-games-${ymd(new Date())}.${ext}`

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadText(filename, text) {
  downloadBlob(filename, new Blob([text], { type: 'application/x-chess-pgn' }))
}

/** `files`: object of filename → text. */
export function downloadZip(filename, files) {
  const entries = Object.fromEntries(Object.entries(files).map(([name, text]) => [name, strToU8(text)]))
  downloadBlob(filename, new Blob([zipSync(entries, { level: 6 })], { type: 'application/zip' }))
}

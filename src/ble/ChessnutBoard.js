import {
  CMD,
  UUID,
  decodePlacement,
  ledFrame,
  parseBattery,
  parseCount,
  parseTransferHeader,
  parseVersion,
  toHex,
} from './protocol.js'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// A command written too soon after a mode switch (21 01 xx) leaves the board's MCU ignoring LED and
// MCU-version commands until it is power-cycled; 500 ms is the gap verified to be safe.
const MODE_SETTLE_MS = 500

/** Resolves true when `promise` settles first, false after `ms`. */
const within = (promise, ms) => Promise.race([promise.then(() => true), sleep(ms).then(() => false)])

const isMarker = (b, code) => b.length >= 3 && b[0] === 0x37 && b[1] === 0x01 && b[2] === code

/**
 * Web Bluetooth connection to a Chessnut Air.
 * Events: `status` (detail: 'disconnected' | 'connecting' | 'connected'), `placement` (detail: FEN placement),
 * `busy` (detail: boolean), `log` (detail: { dir, hex, t }).
 */
export class ChessnutBoard extends EventTarget {
  static isSupported() {
    return typeof navigator !== 'undefined' && !!navigator.bluetooth
  }

  status = 'disconnected'
  busy = false
  device = null
  #cmdChar = null
  #writeQueue = Promise.resolve()
  #exclusiveQueue = Promise.resolve()
  #pending = 0
  #waiters = new Set()
  #collector = null
  #lastPlacement = null
  #lastLed = null
  #listening = new WeakSet()

  get deviceName() {
    return this.device?.name ?? null
  }

  #emit(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail }))
  }

  #setStatus(status) {
    this.status = status
    this.#emit('status', status)
  }

  #log(dir, bytes) {
    this.#emit('log', { dir, hex: toHex(bytes), t: Date.now() })
  }

  async connect() {
    const device = await navigator.bluetooth.requestDevice({
      filters: [{ namePrefix: 'Chessnut' }],
      optionalServices: [UUID.cmdService, UUID.fenService, UUID.fileService],
    })
    if (device !== this.device) {
      device.addEventListener('gattserverdisconnected', () => this.#onDisconnected())
      this.device = device
    }
    await this.#connectGatt()
  }

  async reconnect() {
    if (!this.device) throw new Error('No board to reconnect to')
    await this.#connectGatt()
  }

  async disconnect() {
    if (!this.device?.gatt.connected) return
    await this.send(ledFrame([])).catch(() => {})
    this.device.gatt.disconnect()
  }

  async #connectGatt() {
    this.#setStatus('connecting')
    try {
      const server = await this.device.gatt.connect()
      const cmdService = await server.getPrimaryService(UUID.cmdService)
      const fenService = await server.getPrimaryService(UUID.fenService)
      const fileService = await server.getPrimaryService(UUID.fileService)
      this.#cmdChar = await cmdService.getCharacteristic(UUID.cmdWrite)
      const cmdNotify = await cmdService.getCharacteristic(UUID.cmdNotify)
      const fenNotify = await fenService.getCharacteristic(UUID.fenNotify)
      const fileNotify = await fileService.getCharacteristic(UUID.fileNotify)
      for (const [char, handler] of [
        [cmdNotify, this.#onCmd],
        [fenNotify, this.#onFen],
        [fileNotify, this.#onFile],
      ]) {
        if (!this.#listening.has(char)) {
          char.addEventListener('characteristicvaluechanged', (e) => handler.call(this, frameOf(e)))
          this.#listening.add(char)
        }
        await char.startNotifications()
      }
      this.#lastPlacement = null
      this.#lastLed = null
      this.#writeQueue = Promise.resolve()
      await this.send(CMD.realtime)
      this.#setStatus('connected')
    } catch (err) {
      if (this.device.gatt.connected) this.device.gatt.disconnect()
      this.#onDisconnected()
      throw err
    }
  }

  #onDisconnected() {
    this.#cmdChar = null
    this.#lastPlacement = null
    if (this.status !== 'disconnected') this.#setStatus('disconnected')
  }

  #onCmd(b) {
    this.#log('cmd', b)
    const c = this.#collector
    if (c) {
      const header = parseTransferHeader(b)
      if (header) c.gotHeader(header)
      else if (isMarker(b, 0xbe)) c.started = true
      else if (isMarker(b, 0xed)) c.gotEnd()
    }
    for (const w of [...this.#waiters]) {
      const value = w.parse(b)
      if (value != null) w.resolve(value)
    }
  }

  #onFen(b) {
    if (this.busy) return
    const placement = decodePlacement(b)
    if (!placement || placement === this.#lastPlacement) return
    this.#lastPlacement = placement
    this.#log('fen', b)
    this.#emit('placement', placement)
  }

  #onFile(b) {
    this.#log('file', b)
    const c = this.#collector
    if (!c?.started || c.ended) return
    const placement = decodePlacement(b)
    if (placement) c.placements.push(placement)
  }

  /** Write a command without response; writes are serialised so GATT operations never overlap. */
  send(bytes) {
    const run = this.#writeQueue.then(async () => {
      if (!this.#cmdChar) throw new Error('Not connected')
      this.#log('out', bytes)
      await this.#cmdChar.writeValueWithoutResponse(bytes)
    })
    this.#writeQueue = run.catch(() => {}).then(() => (bytes[0] === 0x21 ? sleep(MODE_SETTLE_MS) : undefined))
    return run
  }

  /** First command reply for which `parse` returns non-null; rejects with Error('timeout'). */
  waitFor(parse, timeoutMs) {
    return new Promise((resolve, reject) => {
      const waiter = {
        parse,
        resolve: (value) => {
          clearTimeout(timer)
          this.#waiters.delete(waiter)
          resolve(value)
        },
      }
      const timer = setTimeout(() => {
        this.#waiters.delete(waiter)
        reject(new Error('timeout'))
      }, timeoutMs)
      this.#waiters.add(waiter)
    })
  }

  async #request(cmd, parse, timeoutMs) {
    const reply = this.waitFor(parse, timeoutMs)
    await this.send(cmd)
    return reply
  }

  /** Run `fn` after every earlier exclusive operation has finished; `busy` is true meanwhile. */
  runExclusive(fn) {
    this.#setBusy(++this.#pending > 0)
    const run = this.#exclusiveQueue.then(fn).finally(() => {
      this.#setBusy(--this.#pending > 0)
      if (!this.busy) this.#lastPlacement = null
    })
    this.#exclusiveQueue = run.catch(() => {})
    return run
  }

  #setBusy(busy) {
    if (busy === this.busy) return
    this.busy = busy
    this.#emit('busy', busy)
  }

  getGameCount() {
    return this.#request(CMD.fileCount, parseCount, 3000)
  }

  /**
   * Placements of the newest stored game. Without `saveThenDelete` the game stays on the board.
   * With it, that async callback receives the placements and the game is deleted from the board only after
   * the callback resolves. The board accepts the delete only in upload mode, i.e. before switching back to realtime.
   */
  async readNewestGame(saveThenDelete) {
    let gotHeader, gotEnd
    const headerArrived = new Promise((r) => (gotHeader = r))
    const endArrived = new Promise((r) => (gotEnd = r))
    const c = {
      started: false,
      ended: false,
      header: null,
      placements: [],
      gotHeader: (h) => {
        c.header = h
        gotHeader()
      },
      gotEnd: () => {
        c.ended = true
        gotEnd()
      },
    }
    this.#collector = c
    try {
      await this.send(CMD.uploadMode)
      await this.send(CMD.startFileRead)
      await this.send(CMD.readNextChunk)
      // The board sometimes stalls before the header; switching to realtime releases the transfer.
      const kicked = !(await within(headerArrived, 3000))
      if (kicked) await this.send(CMD.realtime)
      if (!(await within(endArrived, 15000))) throw new Error('Transfer incomplete')
      if (c.header && c.placements.length !== c.header.expectedPositions) throw new Error('Transfer incomplete')
      if (saveThenDelete) {
        await saveThenDelete(c.placements)
        if (kicked) throw new Error('The board was busy, so this game was saved but not deleted. Run Import all again.')
        await this.send(CMD.deleteNewest)
        await sleep(1000)
      }
      return c.placements
    } finally {
      this.#collector = null
      await this.send(CMD.realtime).catch(() => {})
    }
  }

  async getInfo() {
    const ask = (cmd, parse) => this.#request(cmd, parse, 2000).catch(() => null)
    const battery = await ask(CMD.battery, parseBattery)
    const bleVersion = await ask(CMD.bleVersion, parseVersion)
    const mcuVersion = await ask(CMD.mcuVersion, parseVersion)
    return { battery, bleVersion, mcuVersion }
  }

  /** Light exactly these squares; skipped when unchanged, busy, or disconnected. */
  setLeds(squares) {
    if (this.busy || !this.#cmdChar) return
    const frame = ledFrame(squares)
    const hex = toHex(frame)
    if (hex === this.#lastLed) return
    this.#lastLed = hex
    this.send(frame).catch(() => {
      this.#lastLed = null
    })
  }
}

function frameOf(event) {
  const v = event.target.value
  return new Uint8Array(v.buffer, v.byteOffset, v.byteLength)
}

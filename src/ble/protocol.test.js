import { describe, expect, it } from 'vitest'
import { decodePlacement, ledFrame, parseCount, parseTransferHeader, toHex } from './protocol.js'

const hex = (s) => Uint8Array.from(s.split(' ').map((x) => parseInt(x, 16)))

describe('decodePlacement', () => {
  it('decodes a captured stored-game frame', () => {
    const frame = hex(
      '01 24 00 00 00 00 20 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 0c 00 00 b0 00 0b 89 04 00 00',
    )
    expect(decodePlacement(frame)).toBe('8/6k1/8/8/8/8/3K4/1Q2Q3')
  })

  it('decodes an empty board', () => {
    expect(decodePlacement(new Uint8Array(38))).toBe('8/8/8/8/8/8/8/8')
  })

  it('rejects frames shorter than 32 bytes', () => {
    expect(decodePlacement(new Uint8Array(31))).toBeNull()
  })
})

describe('ledFrame', () => {
  it('puts h8 in bit 0 of the first rank byte', () => {
    expect(toHex(ledFrame(['h8']))).toBe('0a 08 01 00 00 00 00 00 00 00')
  })

  it('puts a1 in bit 7 of the last byte', () => {
    expect(ledFrame(['a1'])[9]).toBe(0x80)
  })

  it('puts e4 in the rank-4 byte', () => {
    expect(ledFrame(['e4'])[6]).toBe(0x08)
  })

  it('ignores invalid square names', () => {
    expect(toHex(ledFrame(['z9', 'e', '']))).toBe('0a 08 00 00 00 00 00 00 00 00')
  })
})

describe('reply parsers', () => {
  it('parses the game count', () => {
    expect(parseCount(Uint8Array.from([0x32, 1, 2]))).toBe(2)
    expect(parseCount(Uint8Array.from([0x23, 1, 0]))).toBeNull()
  })

  it('derives the position count from the transfer header', () => {
    expect(parseTransferHeader(hex('36 08 a2 01 00 00 c0 04 00 00'))).toEqual({ expectedPositions: 11 })
  })
})

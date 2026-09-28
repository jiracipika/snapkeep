import { describe, expect, it } from 'vitest'
import {
  hasExifApp1,
  insertExif,
  readExifDateTimeOriginal,
} from './jpeg'
import {
  looksLikeMp4,
  patchMp4CreationDates,
  readMp4CreationDate,
} from './mp4'
import { fakeJpeg, fakeMp4 } from '@/lib/testutil/snapchatFixtures'

/** Wraps fake bytes in a JPEG-ish structure: SOI + APP0(JFIF) + data + EOI. */
function jpegish(payload: Uint8Array): Uint8Array {
  const jfif = new Uint8Array([
    0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
    0x00, 0x01, 0x00, 0x00,
  ])
  const eoi = new Uint8Array([0xff, 0xd9])
  const out = new Uint8Array(2 + jfif.length + payload.length + eoi.length)
  out.set([0xff, 0xd8], 0)
  out.set(jfif, 2)
  out.set(payload, 2 + jfif.length)
  out.set(eoi, 2 + jfif.length + payload.length)
  return out
}

function box(type: string, content: Uint8Array): Uint8Array {
  const out = new Uint8Array(8 + content.length)
  new DataView(out.buffer).setUint32(0, out.length)
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i)
  out.set(content, 8)
  return out
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0)
  const out = new Uint8Array(total)
  let at = 0
  for (const p of parts) {
    out.set(p, at)
    at += p.length
  }
  return out
}

function u32(v: number): Uint8Array {
  const out = new Uint8Array(4)
  new DataView(out.buffer).setUint32(0, v)
  return out
}

/** Minimal moov: mvhd v0 + trak{ tkhd v0, mdia{ mdhd v0 } }. */
function mp4ish(creationSec: number): Uint8Array {
  const ftyp = box('ftyp', new TextEncoder().encode('isom'))
  const mvhd = box('mvhd', concat(u32(0), u32(creationSec), u32(creationSec), u32(1000), u32(5000)))
  const tkhd = box('tkhd', concat(u32(0), u32(creationSec), u32(creationSec)))
  const mdhd = box('mdhd', concat(u32(0), u32(creationSec), u32(creationSec), u32(1000)))
  const mdia = box('mdia', mdhd)
  const trak = box('trak', concat(tkhd, mdia))
  const moov = box('moov', concat(mvhd, trak))
  return concat(ftyp, moov)
}

const CAPTURE = Date.UTC(2021, 2, 2, 8, 15, 0)

describe('JPEG EXIF write-back', () => {
  it('inserts an EXIF APP1 with a readable DateTimeOriginal', () => {
    const original = jpegish(fakeJpeg(1, 512))
    const out = insertExif(original, { dateMs: CAPTURE })
    expect(out.length).toBeGreaterThan(original.length)
    expect(readExifDateTimeOriginal(out)).toBe(CAPTURE)
    expect(hasExifApp1(out)).toBe(true)
  })

  it('includes GPS coordinates when provided', () => {
    const original = jpegish(fakeJpeg(2, 256))
    const out = insertExif(original, { dateMs: CAPTURE, lat: 45.95817, lon: -66.6471 })
    expect(readExifDateTimeOriginal(out)).toBe(CAPTURE)
    // TIFF must contain a GPS IFD pointer entry (0x8825)
    const dv = new DataView(out.buffer)
    // locate APP1 → tiff
    const tiffStart = 2 + 2 + 2 + 6 + 4 + 6 + 6 // SOI + APP0 + APP1 hdr + Exif id … simpler: scan
    let pos = -1
    for (let i = 0; i < out.length - 4; i++) {
      if (out[i] === 0x49 && out[i + 1] === 0x49 && dv.getUint16(i + 2, true) === 0x2a) {
        pos = i
        break
      }
    }
    expect(pos).toBeGreaterThan(0)
    const ifd0 = dv.getUint32(pos + 4, true)
    const count = dv.getUint16(pos + ifd0, true)
    const tags: number[] = []
    for (let i = 0; i < count; i++) {
      tags.push(dv.getUint16(pos + ifd0 + 2 + i * 12, true))
    }
    expect(tiffStart).toBeGreaterThan(0) // sanity on scan
    expect(tags).toContain(0x8769)
    expect(tags).toContain(0x8825)
  })

  it('leaves files that already have EXIF untouched', () => {
    const original = jpegish(fakeJpeg(3, 128))
    const once = insertExif(original, { dateMs: CAPTURE })
    const twice = insertExif(once, { dateMs: Date.UTC(2030, 0, 1) })
    expect(twice).toBe(once)
    expect(readExifDateTimeOriginal(twice)).toBe(CAPTURE)
  })

  it('passes through non-JPEG bytes unchanged', () => {
    const notJpeg = fakeJpeg(4, 64).slice(2) // missing SOI
    expect(insertExif(notJpeg, { dateMs: CAPTURE })).toBe(notJpeg)
  })
})

describe('MP4 creation-date patch', () => {
  it('reads and patches mvhd/tkhd/mdhd without changing size', () => {
    const original = mp4ish(0) // epoch 1904 → garbage date
    expect(looksLikeMp4(original)).toBe(true)
    const patched = patchMp4CreationDates(original, CAPTURE)
    expect(patched.length).toBe(original.length)
    expect(readMp4CreationDate(patched)).toBe(CAPTURE)
    // mdat-equivalent payload region (outside moov) is untouched
    expect(original[0]).toBe(patched[0])
  })

  it('leaves files without moov boxes unchanged', () => {
    const bare = fakeMp4(5, 512)
    expect(patchMp4CreationDates(bare, CAPTURE)).toBe(bare)
    expect(readMp4CreationDate(bare)).toBeNull()
  })

  it('ignores non-MP4 input', () => {
    const jpegBytes = fakeJpeg(6, 64)
    expect(readMp4CreationDate(jpegBytes)).toBeNull()
    expect(patchMp4CreationDates(jpegBytes, CAPTURE)).toBe(jpegBytes)
  })

  it('handles version 1 (64-bit) header boxes', () => {
    const ftyp = box('ftyp', new TextEncoder().encode('isom'))
    const v1Body = concat(u32(1), u32(0), u32(0), u32(1000), u32(5000))
    const mvhd = box('mvhd', v1Body)
    const moov = box('moov', mvhd)
    const patched = patchMp4CreationDates(concat(ftyp, moov), CAPTURE)
    expect(readMp4CreationDate(patched)).toBe(CAPTURE)
  })
})

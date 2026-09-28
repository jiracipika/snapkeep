/**
 * Deterministic STORE-only ZIP builder for synthetic test fixtures.
 * Lets tests construct edge cases the normal tools won't produce:
 * zip64 entries, data-descriptor records, lying size fields, encrypted flags.
 */

import { crc32 } from '../zip/crc32'

export interface FixtureEntry {
  name: string
  data: Uint8Array
  mtime?: Date
  /** Write zip64 extra fields + EOCD64 (exercises the zip64 reader path). */
  forceZip64?: boolean
  /** Set the data-descriptor flag and trailing descriptor (streamed writers). */
  dataDescriptor?: boolean
  /** Set the "encrypted" general purpose bit. */
  encryptedFlag?: boolean
  /** Compression method byte (8 = deflate; fixture data must then be deflated raw). */
  method?: number
  /** Override the central-directory compressed size (simulates corrupt/truncated). */
  cdSizeOverride?: number
}

function dosDateTime(d: Date): { date: number; time: number } {
  const year = Math.max(1980, d.getUTCFullYear())
  const date = ((year - 1980) << 9) | ((d.getUTCMonth() + 1) << 5) | d.getUTCDate()
  const time =
    (d.getUTCHours() << 11) | (d.getUTCMinutes() << 5) | (d.getUTCSeconds() >> 1)
  return { date, time }
}

function u16(arr: number[], v: number) {
  arr.push(v & 0xff, (v >> 8) & 0xff)
}
function u32(arr: number[], v: number) {
  arr.push(v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff)
}
/** ZIP64 8-byte little-endian. Values above 2^53 are impossible in tests. */
function u64(arr: number[], v: number) {
  const lo = v % 2 ** 32
  const hi = Math.floor(v / 2 ** 32)
  u32(arr, lo)
  u32(arr, hi)
}

export function buildStoreZip(entries: FixtureEntry[]): Uint8Array {
  const local: number[] = []
  const central: number[] = []
  const centralStarts: number[] = []
  let anyZip64 = false

  for (const e of entries) {
    const nameBytes = new TextEncoder().encode(e.name)
    const { date, time } = dosDateTime(e.mtime ?? new Date(Date.UTC(2024, 0, 1, 12, 30, 0)))
    const crc = crc32(e.data)
    const dd = e.dataDescriptor ?? false
    const z64 = e.forceZip64 ?? false
    if (z64) anyZip64 = true
    const flags = (dd ? 0x8 : 0) | (e.encryptedFlag ? 0x1 : 0)
    const csize = e.cdSizeOverride ?? e.data.length
    const method = e.method ?? 0

    const localOffset = local.length
    centralStarts.push(localOffset)
    u32(local, 0x04034b50)
    u16(local, z64 ? 45 : 20) // version needed
    u16(local, flags)
    u16(local, method)
    u16(local, time)
    u16(local, date)
    u32(local, crc)
    u32(local, dd ? 0 : e.data.length)
    u32(local, dd ? 0 : e.data.length)
    u16(local, nameBytes.length)
    u16(local, 0) // extra len
    local.push(...nameBytes)
    local.push(...e.data)
    if (dd) {
      u32(local, 0x08074b50)
      u32(local, crc)
      u32(local, e.data.length)
      u32(local, e.data.length)
    }

    const cdStart = central.length
    void cdStart
    u32(central, 0x02014b50)
    u16(central, z64 ? 45 : 20) // version made by
    u16(central, z64 ? 45 : 20) // version needed
    u16(central, flags)
    u16(central, method)
    u16(central, time)
    u16(central, date)
    u32(central, crc)
    u32(central, z64 ? 0xffffffff : csize)
    u32(central, z64 ? 0xffffffff : e.data.length)
    u16(central, nameBytes.length)
    let extraLen = 0
    if (z64) extraLen = 28
    u16(central, extraLen)
    u16(central, 0) // comment len
    u16(central, 0) // disk start
    u16(central, 0) // internal attrs
    u32(central, 0) // external attrs
    u32(central, z64 ? 0xffffffff : localOffset)
    central.push(...nameBytes)
    if (z64) {
      u16(central, 0x0001)
      u16(central, 24)
      u64(central, e.data.length) // uncompressed
      u64(central, csize) // compressed
      u64(central, localOffset) // local header offset
    }
  }

  const cdOffset = local.length
  const cdSize = central.length

  const out: number[] = [...local, ...central]
  if (anyZip64) {
    const z64Offset = out.length
    u32(out, 0x06064b50)
    u64(out, 44) // size of remaining record
    u16(out, 45)
    u16(out, 45)
    u32(out, 0)
    u32(out, 0)
    u64(out, entries.length)
    u64(out, entries.length)
    u64(out, cdSize)
    u64(out, cdOffset)
    // locator
    u32(out, 0x07064b50)
    u32(out, 0)
    u64(out, z64Offset)
    u32(out, 1)
  }
  u32(out, 0x06054b50)
  u16(out, 0)
  u16(out, 0)
  u16(out, anyZip64 ? 0xffff : entries.length)
  u16(out, anyZip64 ? 0xffff : entries.length)
  u32(out, anyZip64 ? 0xffffffff : cdSize)
  u32(out, anyZip64 ? 0xffffffff : cdOffset)
  u16(out, 0)

  return new Uint8Array(out)
}

/** A deterministic pseudo-random byte buffer (incompressible-ish patterns). */
export function noiseBytes(seed: number, length: number): Uint8Array {
  const out = new Uint8Array(length)
  let s = seed >>> 0
  for (let i = 0; i < length; i++) {
    s = (s * 1664525 + 1013904223) >>> 0
    out[i] = s & 0xff
  }
  return out
}

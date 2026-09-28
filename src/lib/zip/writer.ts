import { crc32Final, crc32Init, crc32Update } from './crc32'

/**
 * Store-only ZIP writer with zip64 + true streaming output.
 *
 * Why not fflate's Zip: it writes 32-bit sizes only (zip64 is read-only in
 * fflate 0.8), and Snapchat exports spanned across many archive parts can
 * exceed 4 GB / 65,535 files. Media is STORED, never recompressed: output
 * bytes are identical to the source archive's, and packing is fast.
 *
 * Bytes are emitted through a single async `onChunk` callback, so callers can
 * stream straight to disk (File System Access) without holding the archive
 * in memory. Entries smaller than `STREAM_THRESHOLD` are buffered first so a
 * mid-file failure never produces a broken entry; larger entries stream with
 * a data descriptor and are zero-padded + reported on failure.
 */

export class StoreZipWriter {
  private offset = 0
  private entryCount = 0
  private central: Uint8Array[] = []
  private centralLen = 0
  private anyEntryZip64 = false
  private finished = false
  private onChunk: (chunk: Uint8Array) => void | Promise<void>
  private streamThreshold: number

  constructor(
    onChunk: (chunk: Uint8Array) => void | Promise<void>,
    streamThreshold = 256 * 1024 * 1024,
  ) {
    this.onChunk = onChunk
    this.streamThreshold = streamThreshold
  }

  get entries(): number {
    return this.entryCount
  }

  /**
   * Adds one file. `size` must be the exact stored byte count; `write` must
   * emit exactly that many bytes. Returns false if the file failed mid-write
   * (only possible for entries above the stream threshold).
   */
  async add(
    path: string,
    size: number,
    mtime: Date | undefined,
    write: (sink: (chunk: Uint8Array) => void | Promise<void>) => void | Promise<void>,
  ): Promise<boolean> {
    if (this.finished) throw new Error('Writer already finished')
    assertSafeArchivePath(path)
    if (size > Number.MAX_SAFE_INTEGER) throw new Error('Entry too large')

    const nameBytes = new TextEncoder().encode(path)
    if (nameBytes.length > 0xffff) throw new Error(`Archive name too long: ${path}`)
    const { date, time } = dosDateTime(mtime)
    const entryZip64 = size >= 0xffffffff
    if (entryZip64) this.anyEntryZip64 = true

    if (size < this.streamThreshold) {
      // Buffer first: nothing touches the output until the file is complete,
      // so CRC failures and read errors can never corrupt the archive.
      const parts: Uint8Array[] = []
      let written = 0
      const crc = { v: crc32Init() }
      await write((chunk) => {
        parts.push(chunk)
        crc.v = crc32Update(crc.v, chunk)
        written += chunk.length
      })
      if (written !== size) {
        throw new Error(`Entry "${path}" produced ${written} bytes, expected ${size}`)
      }
      const crcVal = crc32Final(crc.v)
      await this.emit(
        localHeader(nameBytes, {
          flags: 0x800,
          time,
          date,
          crc: crcVal,
          size,
          entryZip64,
          versionNeeded: entryZip64 ? 45 : 20,
        }),
      )
      for (const part of parts) await this.emit(part)
      this.writeCentralEntry(nameBytes, {
        flags: 0x800,
        time,
        date,
        crc: crcVal,
        size,
        offset: this.offset - size - localHeaderSize(nameBytes, entryZip64),
        entryZip64,
        offsetZip64: false,
      })
      this.entryCount++
      return true
    }

    // Large entry: stream with a data descriptor. Local header carries the
    // (known) sizes; the CRC is only knowable after the bytes flow.
    const entryOffset = this.offset
    await this.emit(
      localHeader(nameBytes, {
        flags: 0x800 | 0x08,
        time,
        date,
        crc: 0,
        size,
        entryZip64,
        versionNeeded: entryZip64 ? 45 : 20,
      }),
    )
    const crc = { v: crc32Init() }
    let written = 0
    let failed = false
    try {
      await write(async (chunk) => {
        crc.v = crc32Update(crc.v, chunk)
        written += chunk.length
        await this.emit(chunk)
      })
    } catch {
      failed = true
    }
    if (written < size) {
      failed = true
      // Keep the archive structurally valid: pad the remainder with zeros.
      const pad = new Uint8Array(Math.min(size - written, 64 * 1024 * 1024))
      while (written < size) {
        const n = Math.min(pad.length, size - written)
        await this.emit(pad.subarray(0, n))
        written += n
      }
    }
    const crcVal = crc32Final(crc.v)
    const desc = new Uint8Array(entryZip64 ? 28 : 16)
    const dv = new DataView(desc.buffer)
    dv.setUint32(0, 0x08074b50, true)
    dv.setUint32(4, crcVal, true)
    if (entryZip64) {
      dv.setUint32(12, 0, true)
      dv.setUint32(16, size, true)
      dv.setUint32(20, 0, true)
      dv.setUint32(24, size, true)
    } else {
      dv.setUint32(8, size, true)
      dv.setUint32(12, size, true)
    }
    await this.emit(desc)

    this.writeCentralEntry(nameBytes, {
      flags: 0x800 | 0x08,
      time,
      date,
      crc: crcVal,
      size,
      offset: entryOffset,
      entryZip64,
      offsetZip64: entryOffset >= 0xffffffff,
    })
    this.entryCount++
    return !failed
  }

  /** Flushes the central directory + EOCD (zip64 when required). */
  async finish(): Promise<void> {
    if (this.finished) return
    this.finished = true

    const cdOffset = this.offset
    for (const chunk of this.central) await this.emit(chunk)
    const cdSize = this.offset - cdOffset

    const countsOverflow = this.entryCount >= 0xffff
    const offsetsOverflow = cdOffset >= 0xffffffff || cdSize >= 0xffffffff
    const outputZip64 = this.anyEntryZip64 || countsOverflow || offsetsOverflow

    if (outputZip64) {
      const z64 = new Uint8Array(56 + 20)
      const dv = new DataView(z64.buffer)
      dv.setUint32(0, 0x06064b50, true)
      dv.setUint32(4, 44, true) // size of remaining record
      dv.setUint16(12, 45, true)
      dv.setUint16(14, 45, true)
      dv.setUint32(24, this.entryCount, true)
      dv.setUint32(32, this.entryCount, true)
      dv.setUint32(40, cdSize, true)
      dv.setUint32(48, cdOffset, true)
      await this.emit(z64)

      const loc = new Uint8Array(20)
      const ldv = new DataView(loc.buffer)
      ldv.setUint32(0, 0x07064b50, true)
      ldv.setUint32(8, cdOffset, true)
      ldv.setUint32(16, 1, true)
      await this.emit(loc)
    }

    const eocd = new Uint8Array(22)
    const dv = new DataView(eocd.buffer)
    dv.setUint32(0, 0x06054b50, true)
    dv.setUint16(8, outputZip64 ? 0xffff : this.entryCount, true)
    dv.setUint16(10, outputZip64 ? 0xffff : this.entryCount, true)
    dv.setUint32(12, outputZip64 ? 0xffffffff : cdSize, true)
    dv.setUint32(16, outputZip64 ? 0xffffffff : cdOffset, true)
    await this.emit(eocd)
  }

  private async emit(chunk: Uint8Array): Promise<void> {
    await this.onChunk(chunk)
    this.offset += chunk.length
  }

  private writeCentralEntry(
    nameBytes: Uint8Array,
    e: {
      flags: number
      time: number
      date: number
      crc: number
      size: number
      offset: number
      entryZip64: boolean
      offsetZip64: boolean
    },
  ): void {
    const sizeOverflow = e.entryZip64
    const offsetOverflow = e.offsetZip64
    const extraFields: number[] = []
    if (sizeOverflow || offsetOverflow) {
      const len = (sizeOverflow ? 16 : 0) + (offsetOverflow ? 8 : 0)
      extraFields.push(0x01, 0x00, len & 0xff, (len >> 8) & 0xff)
      if (sizeOverflow) {
        pushU64(extraFields, e.size)
        pushU64(extraFields, e.size)
      }
      if (offsetOverflow) pushU64(extraFields, e.offset)
    }
    const extra = new Uint8Array(extraFields)
    const entry = new Uint8Array(46 + nameBytes.length + extra.length)
    const dv = new DataView(entry.buffer)
    dv.setUint32(0, 0x02014b50, true)
    dv.setUint16(4, e.entryZip64 ? 45 : 20, true) // version made by
    dv.setUint16(6, e.entryZip64 ? 45 : 20, true) // version needed
    dv.setUint16(8, e.flags, true)
    dv.setUint16(10, 0, true) // method: stored
    dv.setUint16(12, e.time, true)
    dv.setUint16(14, e.date, true)
    dv.setUint32(16, e.crc, true)
    dv.setUint32(20, sizeOverflow ? 0xffffffff : e.size, true)
    dv.setUint32(24, sizeOverflow ? 0xffffffff : e.size, true)
    dv.setUint16(28, nameBytes.length, true)
    dv.setUint16(30, extra.length, true)
    dv.setUint32(42, offsetOverflow ? 0xffffffff : e.offset, true)
    entry.set(nameBytes, 46)
    entry.set(extra, 46 + nameBytes.length)
    this.central.push(entry)
    this.centralLen += entry.length
  }
}

function pushU64(arr: number[], v: number): void {
  const lo = v >>> 0
  const hi = Math.floor(v / 2 ** 32) >>> 0
  arr.push(lo & 0xff, (lo >>> 8) & 0xff, (lo >>> 16) & 0xff, (lo >>> 24) & 0xff)
  arr.push(hi & 0xff, (hi >>> 8) & 0xff, (hi >>> 16) & 0xff, (hi >>> 24) & 0xff)
}

function setU64(dv: DataView, pos: number, v: number): void {
  dv.setUint32(pos, v >>> 0, true)
  dv.setUint32(pos + 4, Math.floor(v / 2 ** 32) >>> 0, true)
}

function localHeaderSize(nameBytes: Uint8Array, entryZip64: boolean): number {
  return 30 + nameBytes.length + (entryZip64 ? 20 : 0)
}

function localHeader(
  nameBytes: Uint8Array,
  o: {
    flags: number
    time: number
    date: number
    crc: number
    size: number
    entryZip64: boolean
    versionNeeded: number
  },
): Uint8Array {
  const out = new Uint8Array(localHeaderSize(nameBytes, o.entryZip64))
  const dv = new DataView(out.buffer)
  dv.setUint32(0, 0x04034b50, true)
  dv.setUint16(4, o.versionNeeded, true)
  dv.setUint16(6, o.flags, true)
  dv.setUint16(8, 0, true) // method: stored
  dv.setUint16(10, o.time, true)
  dv.setUint16(12, o.date, true)
  dv.setUint32(14, o.crc, true)
  if (o.entryZip64) {
    dv.setUint32(18, 0xffffffff, true)
    dv.setUint32(22, 0xffffffff, true)
    dv.setUint16(28, 20, true) // extra len
    const base = 30 + nameBytes.length
    out.set([0x01, 0x00, 16, 0], base)
    setU64(dv, base + 4, o.size) // uncompressed
    setU64(dv, base + 12, o.size) // compressed
  } else {
    dv.setUint32(18, o.size, true)
    dv.setUint32(22, o.size, true)
  }
  dv.setUint16(26, nameBytes.length, true)
  out.set(nameBytes, 30)
  return out
}

function dosDateTime(d: Date | undefined): { date: number; time: number } {
  const t = d && Number.isFinite(d.getTime()) ? d : new Date()
  // Store the UTC components directly: our reader decodes DOS fields as UTC,
  // so capture dates round-trip exactly (DOS itself is 2-second resolution).
  const year = Math.max(1980, t.getUTCFullYear())
  const date = ((year - 1980) << 9) | ((t.getUTCMonth() + 1) << 5) | t.getUTCDate()
  const time =
    (t.getUTCHours() << 11) | (t.getUTCMinutes() << 5) | (t.getUTCSeconds() >> 1)
  return { date, time }
}

const RESERVED_WINDOWS_NAMES = new Set([
  'CON', 'PRN', 'AUX', 'NUL',
  ...Array.from({ length: 9 }, (_, i) => `COM${i + 1}`),
  ...Array.from({ length: 9 }, (_, i) => `LPT${i + 1}`),
])

/**
 * Sanitizes one path segment for Windows/macOS/ZIP-extraction safety.
 * Replaces: / \ : * ? " < > | and control chars; blocks reserved device
 * names; strips leading dots and trailing dots/spaces; caps length.
 */
export function sanitizeSegment(input: string, maxLength = 160): string {
  let s = input.normalize('NFC')
  // oxlint-disable-next-line no-control-regex -- stripping control chars is the point
  s = s.replace(/[/\\:*?"<>|\u0000-\u001f\u007f]/g, '_')
  s = s.replace(/\s+/g, ' ').trim()
  s = s.replace(/^[.\s]+/, '')
  s = s.replace(/[.\s]+$/, '')
  if (s.length > maxLength) s = s.slice(0, maxLength).replace(/[.\s]+$/, '')
  const stem = s.replace(/\.[^.]*$/, '')
  if (RESERVED_WINDOWS_NAMES.has(stem.toUpperCase())) s = `_${s}`
  if (!s) s = 'file'
  return s
}

/** Defense-in-depth for paths written into the output archive. */
export function assertSafeArchivePath(path: string): void {
  if (path.includes('\0')) throw new Error(`Refusing to write path with NUL byte: ${path}`)
  const segments = path.split('/')
  if (path.startsWith('/') || segments.some((seg) => seg === '..' || seg === '')) {
    throw new Error(`Refusing to write unsafe archive path: ${path}`)
  }
  if (segments.length > 16) throw new Error(`Archive path too deep: ${path}`)
}

/**
 * Convenience wrapper with the previous builder surface: collects output
 * chunks in memory and hands back one Blob (fallback for browsers without
 * File System Access).
 */
export class OutputZipBuilder {
  private writer: StoreZipWriter
  private parts: BlobPart[] = []
  private error: Error | null = null

  constructor() {
    this.writer = new StoreZipWriter((chunk) => {
      this.parts.push(chunk.slice())
    })
  }

  get count(): number {
    return this.writer.entries
  }

  add(path: string, bytes: Uint8Array, mtime?: Date): Promise<void> {
    return this.writer.add(path, bytes.length, mtime, async (sink) => {
      sink(bytes)
    }).then(() => undefined)
  }

  async finish(): Promise<Blob> {
    await this.writer.finish()
    if (this.error) throw this.error
    return new Blob(this.parts, { type: 'application/zip' })
  }
}

import { inflateSync, Inflate } from 'fflate'
import { crc32Final, crc32Init, crc32Update } from './crc32'

/**
 * ZIP reading built on the central directory only.
 *
 * Design constraints:
 * - The user's File is never loaded into memory whole; only requested byte
 *   ranges are read. Large archives (many GB) must not exhaust RAM.
 * - Extraction streams in chunks for big entries so a 500 MB video never
 *   needs a 500 MB buffer.
 * - The archive is treated as hostile input: bad signatures, lying sizes,
 *   bombs and unsupported features fail loudly instead of silently.
 */

export type RangeReader = (start: number, end: number) => Promise<Uint8Array>

export interface ZipEntry {
  /** Full path inside the archive, forward slashes. Never trusted for output paths. */
  name: string
  /** Byte offset of the local file header. */
  offset: number
  compressedSize: number
  size: number
  method: number
  flags: number
  crc: number
  /** Modification time from DOS fields, decoded as UTC for determinism. NaN if unset. */
  mtimeMs: number
  encrypted: boolean
}

export interface ZipIndex {
  entries: ZipEntry[]
  totalUncompressed: number
}

export const ZIP_LIMITS = {
  maxEntries: 200_000,
  maxEntrySize: 8 * 1024 ** 3,
  /** uncompressed/compressed ratio above which an entry is treated as a bomb. */
  maxRatio: 10_000,
  /** Max bytes we will allocate to read one central directory. */
  maxDirectorySize: 512 * 1024 ** 2,
  /** Chunk size for streamed extraction. */
  streamChunkSize: 4 * 1024 ** 2,
  /** Entries larger than this extract via streaming instead of one buffer. */
  syncExtractLimit: 32 * 1024 ** 2,
} as const

export class ZipFormatError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ZipFormatError'
  }
}

const SIG_EOCD = 0x06054b50
const SIG_EOCD64 = 0x06064b50
const SIG_EOCD64_LOCATOR = 0x07064b50
const SIG_CD = 0x02014b50
const SIG_LOCAL = 0x04034b50

function readU32(b: Uint8Array, pos: number): number {
  return (b[pos]! | (b[pos + 1]! << 8) | (b[pos + 2]! << 16) | (b[pos + 3]! << 24)) >>> 0
}

function readU16(b: Uint8Array, pos: number): number {
  return b[pos]! | (b[pos + 1]! << 8)
}

function readU64(b: Uint8Array, pos: number): number {
  const lo = readU32(b, pos)
  const hi = readU32(b, pos + 4)
  // ZIP64 sizes beyond Number.MAX_SAFE_INTEGER are rejected by callers.
  return lo + hi * 2 ** 32
}

function dosTimeMs(dosDate: number, dosTime: number): number {
  const year = ((dosDate >> 9) & 0x7f) + 1980
  const month = ((dosDate >> 5) & 0x0f) - 1
  const day = dosDate & 0x1f
  if (year < 1980 || month < 0 || month > 11 || day < 1 || day > 31) return NaN
  const h = (dosTime >> 11) & 0x1f
  const m = (dosTime >> 5) & 0x3f
  const s = (dosTime & 0x1f) * 2
  // DOS timestamps are local time by spec; we decode as UTC so results are
  // deterministic across machines. These dates are a fallback source only.
  return Date.UTC(year, month, day, h, m, s)
}

const nameDecoder = new TextDecoder('utf-8', { fatal: false })

function decodeName(bytes: Uint8Array): string {
  const raw = nameDecoder.decode(bytes)
  // oxlint-disable-next-line no-control-regex -- stripping control chars is the point
  return raw.replace(/[\u0000-\u001f\u007f]/g, '_')
}

interface RawEocd {
  cdOffset: number
  cdSize: number
  totalEntries: number
}

async function locateEocd(read: RangeReader, fileSize: number): Promise<RawEocd> {
  if (fileSize < 22) throw new ZipFormatError('This file is too small to be a ZIP archive.')
  const scanStart = Math.max(0, fileSize - 66_000)
  const buf = await read(scanStart, fileSize)
  let eocdPos = -1
  for (let i = buf.length - 22; i >= 0; i--) {
    if (readU32(buf, i) !== SIG_EOCD) continue
    const commentLen = readU16(buf, i + 20)
    if (scanStart + i + 22 + commentLen === fileSize) {
      eocdPos = i
      break
    }
  }
  if (eocdPos < 0) throw new ZipFormatError('This does not look like a ZIP archive.')

  const eocdAbs = scanStart + eocdPos
  let cdOffset = readU32(buf, eocdPos + 16)
  let cdSize = readU32(buf, eocdPos + 12)
  let totalEntries = readU16(buf, eocdPos + 10)

  const needsZip64 =
    cdOffset === 0xffffffff || cdSize === 0xffffffff || totalEntries === 0xffff
  if (needsZip64 && eocdAbs >= 20) {
    const locStart = eocdAbs - 20
    const locBuf = await read(locStart, locStart + 20)
    if (readU32(locBuf, 0) === SIG_EOCD64_LOCATOR) {
      const z64Offset = readU64(locBuf, 8)
      const z64Buf = await read(z64Offset, Math.min(fileSize, z64Offset + 56))
      if (z64Buf.length >= 56 && readU32(z64Buf, 0) === SIG_EOCD64) {
        totalEntries = readU64(z64Buf, 32)
        cdSize = readU64(z64Buf, 40)
        cdOffset = readU64(z64Buf, 48)
      }
    }
  }

  if (cdOffset > fileSize || cdSize > fileSize - cdOffset) {
    throw new ZipFormatError('This ZIP archive is corrupted (bad central directory).')
  }
  if (cdSize > ZIP_LIMITS.maxDirectorySize) {
    throw new ZipFormatError('This ZIP archive has an unreasonably large directory.')
  }
  return { cdOffset, cdSize, totalEntries }
}

/** Walks the central directory and returns a light index of all entries. */
export async function readZipIndex(read: RangeReader, fileSize: number): Promise<ZipIndex> {
  const { cdOffset, cdSize, totalEntries } = await locateEocd(read, fileSize)
  const cd = await read(cdOffset, cdOffset + cdSize)

  const entries: ZipEntry[] = []
  let totalUncompressed = 0
  let pos = 0
  while (pos + 46 <= cd.length && entries.length < Math.max(totalEntries, 0) + 1) {
    if (readU32(cd, pos) !== SIG_CD) break
    const flags = readU16(cd, pos + 8)
    const method = readU16(cd, pos + 10)
    const dosTime = readU16(cd, pos + 12)
    const dosDate = readU16(cd, pos + 14)
    const crc = readU32(cd, pos + 16)
    let csize = readU32(cd, pos + 20)
    let usize = readU32(cd, pos + 24)
    const nameLen = readU16(cd, pos + 28)
    const extraLen = readU16(cd, pos + 30)
    const commentLen = readU16(cd, pos + 32)
    let offset = readU32(cd, pos + 42)

    const extraStart = pos + 46 + nameLen
    const extraEnd = extraStart + extraLen
    if (extraEnd > cd.length) throw new ZipFormatError('Corrupted entry metadata in archive.')

    // ZIP64 extra field: fields appear in order (size, compressedSize, offset)
    // but only those whose 32-bit CD value was 0xFFFFFFFF.
    let epos = extraStart
    while (epos + 4 <= extraEnd) {
      const id = readU16(cd, epos)
      const sz = readU16(cd, epos + 2)
      if (id === 0x0001 && sz >= 24) {
        let f = epos + 4
        if (usize === 0xffffffff && f + 8 <= epos + 4 + sz) {
          usize = readU64(cd, f)
          f += 8
        }
        if (csize === 0xffffffff && f + 8 <= epos + 4 + sz) {
          csize = readU64(cd, f)
          f += 8
        }
        if (offset === 0xffffffff && f + 8 <= epos + 4 + sz) {
          offset = readU64(cd, f)
          f += 8
        }
        break
      }
      epos += 4 + sz
    }

    if (usize > ZIP_LIMITS.maxEntrySize || csize > fileSize) {
      throw new ZipFormatError(`Archive entry is too large to process safely.`)
    }
    if (
      csize > 0 &&
      usize / csize > ZIP_LIMITS.maxRatio &&
      usize > 512 * 1024 ** 2
    ) {
      throw new ZipFormatError(
        'This archive contains a suspiciously compressed entry (possible ZIP bomb) and was rejected.',
      )
    }

    entries.push({
      name: decodeName(cd.subarray(pos + 46, extraStart)),
      offset,
      compressedSize: csize,
      size: usize,
      method,
      flags,
      crc,
      mtimeMs: dosTimeMs(dosDate, dosTime),
      encrypted: (flags & 0x1) !== 0,
    })
    totalUncompressed += usize
    pos = extraEnd + commentLen
  }

  if (entries.length > ZIP_LIMITS.maxEntries) {
    throw new ZipFormatError(
      `This archive contains more than ${ZIP_LIMITS.maxEntries.toLocaleString()} entries and cannot be processed.`,
    )
  }
  return { entries, totalUncompressed }
}

async function readRange(read: RangeReader, start: number, end: number): Promise<Uint8Array> {
  try {
    return await read(start, end)
  } catch (err) {
    throw new ZipFormatError(
      `Could not read from the archive file (${err instanceof Error ? err.message : 'unknown error'}).`,
    )
  }
}

async function dataStartFor(read: RangeReader, entry: ZipEntry): Promise<number> {
  const header = await readRange(read, entry.offset, entry.offset + 30)
  if (header.length < 30 || readU32(header, 0) !== SIG_LOCAL) {
    throw new ZipFormatError(`Archive entry "${entry.name}" is corrupted.`)
  }
  const nameLen = readU16(header, 26)
  const extraLen = readU16(header, 28)
  return entry.offset + 30 + nameLen + extraLen
}

/**
 * Extracts an entry, delivering uncompressed bytes to `sink`.
 * Small entries arrive as one chunk; large ones stream in bounded chunks.
 * Every extracted byte is CRC-verified against the central directory, so
 * corrupted archives fail loudly instead of exporting damaged media.
 */
export async function extractEntry(
  read: RangeReader,
  entry: ZipEntry,
  sink: (chunk: Uint8Array) => void,
): Promise<void> {
  if (entry.encrypted) {
    throw new ZipFormatError(`"${entry.name}" is password-protected and cannot be extracted.`)
  }
  if (entry.method !== 0 && entry.method !== 8) {
    throw new ZipFormatError(
      `"${entry.name}" uses an unsupported compression method and cannot be extracted.`,
    )
  }
  const dataStart = await dataStartFor(read, entry)
  const dataEnd = dataStart + entry.compressedSize
  const checkCrc = (bytes: Uint8Array, running?: { crc: number }) => {
    if (running) running.crc = crc32Update(running.crc, bytes)
    return running ? crc32Final(running.crc) : crc32Final(crc32Update(crc32Init(), bytes))
  }
  const expectCrc = entry.crc !== 0 || entry.size > 0
  const mismatch = () =>
    new ZipFormatError(`"${entry.name}" is corrupted (failed integrity check) and was skipped.`)

  if (entry.compressedSize <= ZIP_LIMITS.syncExtractLimit) {
    const data = await readRange(read, dataStart, dataEnd)
    let out: Uint8Array
    if (entry.method === 0) {
      out = data
    } else {
      out = new Uint8Array(entry.size)
      try {
        inflateSync(data, { out })
      } catch {
        throw new ZipFormatError(`"${entry.name}" is corrupted and could not be extracted.`)
      }
    }
    if (expectCrc && checkCrc(out) !== entry.crc) throw mismatch()
    sink(out)
    return
  }

  // Large entry: stream through inflate in bounded chunks, verifying CRC.
  const running = { crc: crc32Init() }
  let stream: Inflate | null = null
  if (entry.method === 8) {
    // Sync stream: corruption surfaces as a throw from push().
    stream = new Inflate()
    stream.ondata = (data) => {
      checkCrc(data, running)
      sink(data)
    }
  }
  try {
    for (let pos = dataStart; pos < dataEnd; pos += ZIP_LIMITS.streamChunkSize) {
      const end = Math.min(pos + ZIP_LIMITS.streamChunkSize, dataEnd)
      const chunk = await readRange(read, pos, end)
      try {
        if (stream) {
          stream.push(chunk, end >= dataEnd)
        } else {
          checkCrc(chunk, running)
          sink(chunk)
        }
      } catch {
        throw new ZipFormatError(`"${entry.name}" is corrupted and could not be extracted.`)
      }
      // Yield so a long extraction stays responsive to timers/UI.
      await new Promise((r) => setTimeout(r, 0))
    }
  } finally {
    if (stream) stream.push(new Uint8Array(0), true)
  }
  if (expectCrc && crc32Final(running.crc) !== entry.crc) throw mismatch()
}

/** Convenience: extract an entry fully into one Uint8Array (small entries only). */
export async function extractEntryBytes(read: RangeReader, entry: ZipEntry): Promise<Uint8Array> {
  if (entry.size > ZIP_LIMITS.syncExtractLimit) {
    throw new ZipFormatError(`"${entry.name}" is too large to load into memory at once.`)
  }
  let out: Uint8Array | null = null
  await extractEntry(read, entry, (chunk) => {
    out = chunk
  })
  if (!out) throw new ZipFormatError(`"${entry.name}" produced no data.`)
  return out
}

/** Builds a RangeReader over a File/Blob (works on main thread or in workers). */
export function fileRangeReader(file: Blob): RangeReader {
  return async (start, end) => new Uint8Array(await file.slice(start, end).arrayBuffer())
}

/** Builds a RangeReader over an in-memory buffer (tests, small archives). */
export function bufferRangeReader(buf: Uint8Array): RangeReader {
  return async (start, end) => buf.subarray(start, end)
}

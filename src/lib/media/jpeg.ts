/**
 * Lossless JPEG EXIF writer.
 *
 * Snapchat's pre-2025 exports strip EXIF entirely — galleries fall back to
 * the file's download date ("everything is from today"). This module splices
 * a minimal EXIF APP1 segment (capture date + optional GPS) into JPEGs
 * WITHOUT recompressing a single pixel: the scan data is untouched.
 *
 * Policy: if the file already carries an EXIF APP1, it is left as-is
 * (2025+ Snapchat exports embed dates themselves and may hold orientation
 * data we must not clobber). XMP APP1 segments are preserved.
 */

const SOI = 0xffd8

export interface ExifInput {
  /** Capture time, epoch ms. */
  dateMs: number
  lat?: number | null
  lon?: number | null
}

/** Reads the EXIF DateTimeOriginal from a JPEG, if present (epoch ms). */
export function readExifDateTimeOriginal(bytes: Uint8Array): number | null {
  if (bytes.length < 4 || ((bytes[0]! << 8) | bytes[1]!) !== SOI) return null
  let pos = 2
  while (pos + 4 <= bytes.length) {
    const marker = (bytes[pos]! << 8) | bytes[pos + 1]!
    if (marker === 0xffda) break // SOS: pixel data begins
    if ((marker & 0xff00) !== 0xff00) return null
    const length = ((bytes[pos + 2]! << 8) | bytes[pos + 3]!) - 2
    if (marker === 0xffe1) {
      const seg = bytes.subarray(pos + 4, pos + 4 + length)
      if (seg.length > 6 && seg[0] === 0x45 && seg[1] === 0x78) {
        // "Exif\0\0" + TIFF
        return parseTiffDateTimeOriginal(seg.subarray(6))
      }
    }
    pos += 4 + length // marker(2) + length field(2) + payload
  }
  return null
}

function findExifApp1(bytes: Uint8Array): number | null {
  if (bytes.length < 4 || ((bytes[0]! << 8) | bytes[1]!) !== SOI) return null
  let pos = 2
  while (pos + 4 <= bytes.length) {
    const marker = (bytes[pos]! << 8) | bytes[pos + 1]!
    if (marker === 0xffda) break
    if ((marker & 0xff00) !== 0xff00) return null
    const length = ((bytes[pos + 2]! << 8) | bytes[pos + 3]!) - 2
    if (marker === 0xffe1) {
      const seg = bytes.subarray(pos + 4, pos + 4 + length)
      if (seg.length > 6 && seg[0] === 0x45 && seg[1] === 0x78) return pos
    }
    pos += 4 + length
  }
  return null
}

export function hasExifApp1(bytes: Uint8Array): boolean {
  return findExifApp1(bytes) !== null
}

function parseTiffDateTimeOriginal(tiff: Uint8Array): number | null {
  try {
    const le = String.fromCharCode(tiff[0]!, tiff[1]!) === 'II'
    const rd16 = (p: number) => (le ? tiff[p]! | (tiff[p + 1]! << 8) : (tiff[p]! << 8) | tiff[p + 1]!)
    const rd32 = (p: number) =>
      le
        ? (tiff[p]! | (tiff[p + 1]! << 8) | (tiff[p + 2]! << 16) | (tiff[p + 3]! << 24)) >>> 0
        : ((tiff[p]! << 24) | (tiff[p + 1]! << 16) | (tiff[p + 2]! << 8) | tiff[p + 3]!) >>> 0
    const ifd0 = rd32(4)
    const count = rd16(ifd0)
    for (let i = 0; i < count; i++) {
      const e = ifd0 + 2 + i * 12
      const tag = rd16(e)
      if (tag === 0x8769) {
        const exifIfd = rd32(e + 8)
        const n = rd16(exifIfd)
        for (let j = 0; j < n; j++) {
          const f = exifIfd + 2 + j * 12
          const t = rd16(f)
          if (t === 0x9003) {
            const len = rd32(f + 4)
            const off = len <= 4 ? f + 8 : rd32(f + 8)
            const str = String.fromCharCode(...tiff.subarray(off, off + len - 1))
            const m = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(str)
            if (m) {
              return Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!, +m[4]!, +m[5]!, +m[6]!)
            }
          }
        }
      }
    }
  } catch {
    return null
  }
  return null
}

/**
 * Inserts an EXIF APP1 with the capture date and optional GPS.
 * Returns the original bytes unchanged when EXIF already exists or the
 * input is not a plausible JPEG.
 */
export function insertExif(bytes: Uint8Array, input: ExifInput): Uint8Array {
  if (bytes.length < 4 || ((bytes[0]! << 8) | bytes[1]!) !== SOI) return bytes
  // Require a plausible first segment (APP0/APP1 or a data segment); if the
  // structure doesn't parse, leave the file alone rather than corrupt it.
  if (bytes[2] !== 0xff) return bytes
  let insertAt = 2
  if (bytes[3] === 0xe0 || bytes[3] === 0xe1) {
    const segLen = (bytes[4]! << 8) | bytes[5]!
    if (segLen < 2 || 4 + segLen > bytes.length) return bytes
    if (bytes[3] === 0xe0) insertAt = 4 + segLen
  }
  if (findExifApp1(bytes) !== null) return bytes

  const tiff = buildTiff(input)
  const app1 = new Uint8Array(4 + 6 + tiff.length)
  app1[0] = 0xff
  app1[1] = 0xe1
  const segLen = 6 + tiff.length + 2 // payload("Exif\0\0"+tiff) + length field itself
  app1[2] = segLen >> 8
  app1[3] = segLen & 0xff
  app1.set(new TextEncoder().encode('Exif\0\0'), 4)
  app1.set(tiff, 10)

  // Insert after a leading APP0 (JFIF) if present, else right after SOI.
  const out = new Uint8Array(bytes.length + app1.length)
  out.set(bytes.subarray(0, insertAt), 0)
  out.set(app1, insertAt)
  out.set(bytes.subarray(insertAt), insertAt + app1.length)
  return out
}

// ---------------------------------------------------------------------------
// TIFF builder (little-endian, IFD0 → Exif IFD (+ GPS IFD))
// ---------------------------------------------------------------------------

const exifDate = (ms: number): string => {
  const d = new Date(ms)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}:${p(d.getUTCMonth() + 1)}:${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`
}

function buildTiff(input: ExifInput): Uint8Array {
  const withGps = input.lat != null && input.lon != null
  const dateTime = `${exifDate(input.dateMs)}\0` // 20 bytes
  const offsetTime = `+00:00\0` // 7 bytes → align 8
  void offsetTime

  // Layout: header(8) | IFD0 | Exif IFD | [GPS IFD] | pool
  const ifd0Entries = withGps ? 2 : 1
  const exifEntries = 2 // DateTimeOriginal, DateTimeDigitized
  const gpsEntries = withGps ? 5 : 0

  const ifd0Size = 2 + ifd0Entries * 12 + 4
  const exifIfdOffset = 8 + ifd0Size
  const exifIfdSize = 2 + exifEntries * 12 + 4
  const gpsIfdOffset = exifIfdOffset + exifIfdSize
  const gpsIfdSize = withGps ? 2 + gpsEntries * 12 + 4 : 0
  const poolOffset = gpsIfdOffset + gpsIfdSize

  // Pool: DateTimeOriginal(20) + DateTimeDigitized(20) + GPS lat(24) + lon(24)
  const poolSize = 20 + 20 + (withGps ? 48 : 0)
  const total = poolOffset + poolSize
  const buf = new Uint8Array(total)
  const dv = new DataView(buf.buffer)

  buf[0] = 0x49 // "II"
  buf[1] = 0x49
  dv.setUint16(2, 0x002a, true)
  dv.setUint32(4, 8, true)

  // IFD0
  let p = 8
  dv.setUint16(p, ifd0Entries, true)
  dv.setUint16(p + 2, 0x8769, true) // ExifIFDPointer
  dv.setUint16(p + 4, 4, true) // LONG
  dv.setUint32(p + 6, 1, true)
  dv.setUint32(p + 10, exifIfdOffset, true)
  if (withGps) {
    dv.setUint16(p + 14, 0x8825, true) // GPSInfoIFDPointer
    dv.setUint16(p + 16, 4, true)
    dv.setUint32(p + 18, 1, true)
    dv.setUint32(p + 22, gpsIfdOffset, true)
  }
  dv.setUint32(p + 2 + ifd0Entries * 12, 0, true) // next IFD = 0

  // Exif IFD
  p = exifIfdOffset
  dv.setUint16(p, exifEntries, true)
  const dateBytes = new TextEncoder().encode(dateTime)
  dv.setUint16(p + 2, 0x9003, true) // DateTimeOriginal
  dv.setUint16(p + 4, 2, true) // ASCII
  dv.setUint32(p + 6, 20, true)
  dv.setUint32(p + 10, poolOffset, true)
  dv.setUint16(p + 14, 0x9004, true) // DateTimeDigitized
  dv.setUint16(p + 16, 2, true)
  dv.setUint32(p + 18, 20, true)
  dv.setUint32(p + 22, poolOffset + 20, true)
  dv.setUint32(p + 2 + exifEntries * 12, 0, true)
  buf.set(dateBytes, poolOffset)
  buf.set(dateBytes, poolOffset + 20)

  // GPS IFD
  if (withGps) {
    p = gpsIfdOffset
    dv.setUint16(p, gpsEntries, true)
    const latAbs = Math.abs(input.lat!)
    const lonAbs = Math.abs(input.lon!)
    const latRef = input.lat! >= 0 ? 'N' : 'S'
    const lonRef = input.lon! >= 0 ? 'E' : 'W'
    const latPool = poolOffset + 40
    const lonPool = latPool + 24
    const writeRationals = (offset: number, value: number) => {
      const deg = Math.floor(value)
      const minFull = (value - deg) * 60
      const min = Math.floor(minFull)
      const sec = Math.round((minFull - min) * 600000) / 10
      dv.setUint32(offset, deg, true)
      dv.setUint32(offset + 4, 1, true)
      dv.setUint32(offset + 8, min, true)
      dv.setUint32(offset + 12, 1, true)
      dv.setUint32(offset + 16, Math.round(sec * 100), true)
      dv.setUint32(offset + 20, 100, true)
    }
    const entry = (i: number, tag: number, type: number, count: number, value: number) => {
      dv.setUint16(p + 2 + i * 12, tag, true)
      dv.setUint16(p + 2 + i * 12 + 2, type, true)
      dv.setUint32(p + 2 + i * 12 + 4, count, true)
      dv.setUint32(p + 2 + i * 12 + 8, value, true)
    }
    entry(0, 0x0000, 1, 4, (2 | (3 << 8)) >>> 0) // GPSVersionID 2.3.0.0 inline
    entry(1, 0x0001, 2, 2, latRef.charCodeAt(0)) // LatitudeRef inline
    entry(2, 0x0002, 5, 3, latPool) // Latitude RATIONAL*
    entry(3, 0x0003, 2, 2, lonRef.charCodeAt(0)) // LongitudeRef inline
    entry(4, 0x0004, 5, 3, lonPool) // Longitude RATIONAL*
    dv.setUint32(p + 2 + gpsEntries * 12, 0, true)
    writeRationals(latPool, latAbs)
    writeRationals(lonPool, lonAbs)
  }

  return buf
}

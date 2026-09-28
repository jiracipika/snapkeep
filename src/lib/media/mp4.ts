/**
 * Lossless MP4/MOV creation-date patcher.
 *
 * Google Photos and Apple Photos read the QuickTime container's
 * mvhd/tkhd/mdhd creation_time for the video timeline — when it's missing
 * they fall back to file mtime, which is why exported Memories videos show
 * the wrong date. We overwrite creation_time in place (same byte width, no
 * re-mux, no transcode: the mdat payload is untouched).
 *
 * Video GPS atoms (©xyz) are a planned follow-up; not written here.
 */

const NTP_EPOCH_OFFSET_SEC = 2_082_844_800 // seconds between 1904-01-01 and 1970-01-01

function boxType(b: Uint8Array, p: number): string {
  return String.fromCharCode(b[p]!, b[p + 1]!, b[p + 2]!, b[p + 3]!)
}

export function looksLikeMp4(bytes: Uint8Array): boolean {
  return bytes.length > 12 && boxType(bytes, 4) === 'ftyp'
}

interface HeaderBox {
  type: string
  /** Position of creation_time (right after version+flags). */
  creationPos: number
  version: number
}

function walkHeaderBoxes(bytes: Uint8Array): HeaderBox[] {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const found: HeaderBox[] = []
  const walkRange = (from: number, to: number) => {
    let p = from
    while (p + 8 <= to) {
      let declared = dv.getUint32(p)
      let headerSize = 8
      if (declared === 1) {
        if (p + 16 > to) return
        headerSize = 16
        declared = dv.getUint32(p + 8) * 2 ** 32 + dv.getUint32(p + 12)
      } else if (declared === 0) {
        declared = to - p
      }
      const boxEndPos = p + declared
      if (declared < headerSize || boxEndPos > to) return // malformed: stop
      const type = boxType(bytes, p + 4)
      if (type === 'mvhd' || type === 'tkhd' || type === 'mdhd') {
        found.push({ type, creationPos: p + headerSize + 4, version: bytes[p + 8]! })
      } else if (type === 'moov' || type === 'trak' || type === 'mdia') {
        walkRange(p + headerSize, boxEndPos)
      }
      p = boxEndPos
    }
  }
  walkRange(0, bytes.length)
  return found
}

/** Reads the mvhd creation_time (epoch ms), falling back to tkhd/mdhd. */
export function readMp4CreationDate(bytes: Uint8Array): number | null {
  if (!looksLikeMp4(bytes)) return null
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let fallback: number | null = null
  for (const box of walkHeaderBoxes(bytes)) {
    try {
      let sec: number
      if (box.version === 1) {
        sec = dv.getUint32(box.creationPos) * 2 ** 32 + dv.getUint32(box.creationPos + 4)
      } else {
        sec = dv.getUint32(box.creationPos)
      }
      const ms = (sec - NTP_EPOCH_OFFSET_SEC) * 1000
      if (box.type === 'mvhd') return ms
      fallback ??= ms
    } catch {
      /* truncated: ignore this box */
    }
  }
  return fallback
}

/**
 * Overwrites mvhd/tkhd/mdhd creation_time with the given capture date.
 * Returns a new buffer only when something changed; otherwise the input.
 */
export function patchMp4CreationDates(bytes: Uint8Array, dateMs: number): Uint8Array {
  if (!looksLikeMp4(bytes)) return bytes
  const target = Math.floor(dateMs / 1000) + NTP_EPOCH_OFFSET_SEC
  const dvProto = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const writes: { pos: number; wide: boolean }[] = []
  for (const box of walkHeaderBoxes(bytes)) {
    try {
      if (box.version === 1) {
        writes.push({ pos: box.creationPos, wide: true })
      } else if (target < 2 ** 32) {
        // Verify the zeroth box actually looks like version 0 layout before
        // writing; then record relative to the ORIGINAL buffer.
        dvProto.getUint32(box.creationPos)
        writes.push({ pos: box.creationPos, wide: false })
      }
    } catch {
      /* malformed box: skip */
    }
  }
  if (writes.length === 0) return bytes
  const out = bytes.slice()
  const dv = new DataView(out.buffer)
  for (const w of writes) {
    if (w.wide) {
      dv.setUint32(w.pos, Math.floor(target / 2 ** 32))
      dv.setUint32(w.pos + 4, target % 2 ** 32)
    } else {
      dv.setUint32(w.pos, target)
    }
  }
  return out
}

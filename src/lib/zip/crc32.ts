/** Incremental CRC-32 (IEEE, reflected) for verifying extracted entry bytes. */

let table: Uint32Array | null = null

function getTable(): Uint32Array {
  if (!table) {
    table = new Uint32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      table[n] = c >>> 0
    }
  }
  return table
}

/** Start a CRC (0xffffffff is the standard initial state). */
export function crc32Init(): number {
  return 0xffffffff
}

/** Fold more bytes into an in-progress CRC. */
export function crc32Update(crc: number, data: Uint8Array): number {
  const t = getTable()
  let c = crc
  for (let i = 0; i < data.length; i++) c = (c >>> 8) ^ t[(c ^ data[i]!) & 0xff]!
  return c
}

/** Finish a CRC (XOR with 0xffffffff). */
export function crc32Final(crc: number): number {
  return (crc ^ 0xffffffff) >>> 0
}

export function crc32(data: Uint8Array): number {
  return crc32Final(crc32Update(crc32Init(), data))
}

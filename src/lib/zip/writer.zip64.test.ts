import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import { StoreZipWriter } from './writer'
import { bufferRangeReader, extractEntryBytes, readZipIndex, type RangeReader } from './reader'

const GB = 1024 ** 3
const FAR = 5 * GB // archive begins past the 32-bit boundary

describe('StoreZipWriter zip64 offsets (2GB-per-part exports ⇒ >4GB archives)', () => {
  it('records 64-bit offsets for entries living beyond 4GB', async () => {
    const chunks: Uint8Array[] = []
    const writer = new StoreZipWriter((c) => {
      chunks.push(c)
    }, 64 * 1024, FAR)
    const data = new Uint8Array(1000).fill(7)
    await writer.add('Snapchat Memories/2016/2016-03-15_14-00-02_photo.jpg', data.length, new Date(Date.UTC(2016, 2, 15)), (push) => {
      push(data)
    })
    await writer.finish()

    const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0))
    let at = 0
    for (const c of chunks) {
      out.set(c, at)
      at += c.length
    }

    // Walk the central directory manually: its entries must carry zip64
    // extras whose u64 offset equals FAR + header position.
    const dv = new DataView(out.buffer)
    // locate EOCD (archive tail)
    let eocdPos = -1
    for (let i = out.length - 22; i >= 0; i--) {
      if (dv.getUint32(i, true) === 0x06054b50) {
        eocdPos = i
        break
      }
    }
    expect(eocdPos).toBeGreaterThan(0)
    expect(dv.getUint32(eocdPos + 16, true)).toBe(0xffffffff) // offset sentinel
    // locator sits 20 bytes before EOCD; its u64 offset must be the full 64-bit value
    const locPos = eocdPos - 20
    expect(dv.getUint32(locPos, true)).toBe(0x07064b50)
    const z64Offset = dv.getUint32(locPos + 8, true) + dv.getUint32(locPos + 12, true) * 2 ** 32
    expect(z64Offset).toBeGreaterThan(FAR) // would truncate to <4GB with 32-bit math
    // EOCD64 record itself (buffer positions are absolute minus the FAR base)
    const z64Pos = z64Offset - FAR
    expect(dv.getUint32(z64Pos, true)).toBe(0x06064b50)
    const z64CdOffset = dv.getUint32(z64Pos + 48, true) + dv.getUint32(z64Pos + 52, true) * 2 ** 32
    expect(z64CdOffset).toBeGreaterThan(FAR) // CD begins after the first entry's local data
    // and the central directory's first entry must point at FAR via zip64 extra
    const cdPos = z64CdOffset - FAR // position within our emitted buffer
    expect(dv.getUint32(cdPos, true)).toBe(0x02014b50)
    const nameLen = dv.getUint16(cdPos + 28, true)
    const extraLen = dv.getUint16(cdPos + 30, true)
    expect(dv.getUint32(cdPos + 42, true)).toBe(0xffffffff) // offset sentinel
    const extra = out.subarray(cdPos + 46 + nameLen, cdPos + 46 + nameLen + extraLen)
    expect(extra[0]).toBe(0x01) // zip64 extra id
    const extraPos = cdPos + 46 + nameLen
    const entryOffset = dv.getUint32(extraPos + 4, true) + dv.getUint32(extraPos + 8, true) * 2 ** 32
    expect(entryOffset).toBe(FAR)
  })

  it('round-trips through a sparse file with the archive starting at 5GB', async () => {
    const dir = fs.mkdtempSync('/tmp/snapkeep-zip64-')
    const filePath = `${dir}/sparse.zip`
    const chunks: Uint8Array[] = []
    const writer = new StoreZipWriter((c) => {
      chunks.push(c)
    }, 64 * 1024, FAR)
    const photoA = new Uint8Array(4096).fill(1)
    const photoB = new Uint8Array(4096).fill(2)
    await writer.add('Snapchat Memories/2016/a.jpg', photoA.length, new Date(Date.UTC(2016, 0, 2)), (push) => {
      push(photoA)
    })
    await writer.add('Snapchat Memories/2017/b.jpg', photoB.length, new Date(Date.UTC(2017, 0, 3)), (push) => {
      push(photoB)
    })
    await writer.finish()

    // Write the stream at absolute offset 5GB; the gap stays a hole (sparse).
    const fh = await fs.promises.open(filePath, 'w')
    let pos = FAR
    for (const c of chunks) {
      await fh.write(c, 0, c.length, Number(pos))
      pos += c.length
    }
    await fh.close()

    const reader: RangeReader = async (start, end) => {
      const buf = new Uint8Array(end - start)
      const rfh = await fs.promises.open(filePath, 'r')
      try {
        await rfh.read(buf, 0, buf.length, Number(start))
      } finally {
        await rfh.close()
      }
      return buf
    }
    const index = await readZipIndex(reader, pos)
    expect(index.entries.map((e) => e.name)).toEqual([
      'Snapchat Memories/2016/a.jpg',
      'Snapchat Memories/2017/b.jpg',
    ])
    expect(await extractEntryBytes(reader, index.entries[0]!)).toEqual(photoA)
    expect(await extractEntryBytes(reader, index.entries[1]!)).toEqual(photoB)

    await fs.promises.rm(dir, { recursive: true, force: true })
  }, 60_000)

  it('keeps the small-archive path byte-identical (no zip64 unless needed)', async () => {
    const chunks: Uint8Array[] = []
    const writer = new StoreZipWriter((c) => {
      chunks.push(c)
    })
    await writer.add('x/ok.jpg', 4, undefined, (push) => push(new Uint8Array([1, 2, 3, 4])))
    await writer.finish()
    const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0))
    let at = 0
    for (const c of chunks) {
      out.set(c, at)
      at += c.length
    }
    const index = await readZipIndex(bufferRangeReader(out), out.length)
    expect(index.entries).toHaveLength(1)
    expect(index.entries[0]!.offset).toBe(0) // plain 32-bit, no sentinel
    expect(await extractEntryBytes(bufferRangeReader(out), index.entries[0]!)).toEqual(
      new Uint8Array([1, 2, 3, 4]),
    )
  })
})

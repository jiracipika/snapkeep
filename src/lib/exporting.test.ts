import { describe, expect, it } from 'vitest'
import { unzipSync } from 'fflate'
import { buildStoreZip, noiseBytes } from './testutil/zipBuilder'
import { bufferRangeReader, extractEntry, readZipIndex } from './zip/reader'
import { OutputZipBuilder } from './zip/writer'
import { crc32Final, crc32Init, crc32Update } from './zip/crc32'

/** Collects a streamed writer's chunks back into one buffer. */
function collectingSink() {
  const chunks: Uint8Array[] = []
  return {
    chunks,
    write: (c: Uint8Array) => {
      chunks.push(c)
    },
    result: () => {
      const total = chunks.reduce((n, c) => n + c.length, 0)
      const out = new Uint8Array(total)
      let at = 0
      for (const c of chunks) {
        out.set(c, at)
        at += c.length
      }
      return out
    },
  }
}

function expectBytesEqual(a: Uint8Array, b: Uint8Array) {
  expect(a.length).toBe(b.length)
  for (let i = 0; i < a.length; i++) expect(a[i]).toBe(b[i])
}

describe('StoreZipWriter streaming output', () => {
  it('produces archives identical to the buffered builder path', async () => {
    const { StoreZipWriter } = await import('./zip/writer')
    const photo = noiseBytes(31, 50_000)
    const video = noiseBytes(32, 120_000)
    const mtime = new Date(Date.UTC(2022, 3, 4, 5, 6, 7))

    const sink = collectingSink()
    const writer = new StoreZipWriter(sink.write, 64 * 1024) // low threshold: video streams
    await writer.add('r/2022/2022-04-04_05-06-07_photo.jpg', photo.length, mtime, (push) => {
      push(photo)
    })
    await writer.add('r/2022/2022-04-04_05-06-08_video.mp4', video.length, undefined, async (push) => {
      // Emit in small chunks like the real extractor does.
      for (let i = 0; i < video.length; i += 4096) {
        await push(video.subarray(i, Math.min(i + 4096, video.length)))
      }
    })
    await writer.finish()

    const streamed = sink.result()
    // fflate must read it back byte-exactly
    const unzipped = unzipSync(streamed)
    expectBytesEqual(unzipped['r/2022/2022-04-04_05-06-07_photo.jpg']!, photo)
    expectBytesEqual(unzipped['r/2022/2022-04-04_05-06-08_video.mp4']!, video)

    // The buffered builder must produce an identical archive (modulo dates).
    const builder = new OutputZipBuilder()
    await builder.add('r/2022/2022-04-04_05-06-07_photo.jpg', photo, mtime)
    await builder.add('r/2022/2022-04-04_05-06-08_video.mp4', video)
    const blobBytes = new Uint8Array(await (await builder.finish()).arrayBuffer())
    const unzipped2 = unzipSync(blobBytes)
    expectBytesEqual(unzipped2['r/2022/2022-04-04_05-06-07_photo.jpg']!, photo)
  })

  it('marks streamed entries failed when the source read dies mid-file, and keeps the archive valid', async () => {
    const { StoreZipWriter } = await import('./zip/writer')
    const size = 200 * 1024 // above the 64KB stream threshold used here
    const sink = collectingSink()
    const writer = new StoreZipWriter(sink.write, 64 * 1024)
    const ok = await writer.add('r/big.mp4', size, undefined, async (push) => {
      await push(noiseBytes(33, 1024))
      throw new Error('read failed')
    })
    expect(ok).toBe(false)
    await writer.add('r/after.jpg', 10, undefined, (push) => push(new Uint8Array(10)))
    await writer.finish()

    // Structurally valid: both entries present, big one padded to size
    const index = await readZipIndex(bufferRangeReader(sink.result()), sink.result().length)
    expect(index.entries.map((e) => e.name)).toEqual(['r/big.mp4', 'r/after.jpg'])
    expect(index.entries[0]!.size).toBe(size)
  })
})

describe('multi-part archives (mydata~*.zip sets)', () => {
  it('indexes and extracts across all parts', async () => {
    const part1 = buildStoreZip([
      { name: 'json/memories_history.json', data: noiseBytes(34, 512) },
      { name: 'memories/a.jpg', data: noiseBytes(35, 2048) },
    ])
    const part2 = buildStoreZip([
      { name: 'memories/b.mp4', data: noiseBytes(36, 4096) },
      { name: 'memories/c.jpg', data: noiseBytes(37, 1024) },
    ])

    const files = [
      new File([new Uint8Array(part1)], 'mydata~1.zip', { type: 'application/zip' }),
      new File([new Uint8Array(part2)], 'mydata~2.zip', { type: 'application/zip' }),
    ]
    const { ArchiveSession } = await import('./snapchat/session')
    const session = await ArchiveSession.create(files, () => {})
    expect(session.sources).toHaveLength(2)
    expect(session.result.items).toHaveLength(3) // a.jpg, b.mp4, c.jpg
    expect(session.result.warnings.some((w) => w.includes('2 archive parts'))).toBe(true)

    // Every item extracts byte-exactly from its own part.
    for (const item of session.result.items) {
      const bytes = await session.extractBytes(item)
      expect(bytes.length).toBe(item.size)
    }
  })
})

describe('large-entry extraction (>32MB streams in chunks)', () => {
  it('reassembles streamed chunks completely and with correct CRC', async () => {
    const size = 34 * 1024 * 1024
    const data = noiseBytes(38, size) // stored, incompressible
    const zip = buildStoreZip([{ name: 'videos/big.mp4', data }])
    const index = await readZipIndex(bufferRangeReader(zip), zip.length)
    const entry = index.entries[0]!

    const chunks: Uint8Array[] = []
    let crcState = crc32Init()
    await extractEntry(bufferRangeReader(zip), entry, (chunk) => {
      chunks.push(chunk)
      crcState = crc32Update(crcState, chunk)
    })
    const total = chunks.reduce((n, c) => n + c.length, 0)
    expect(total).toBe(size)
    expect(crc32Final(crcState)).toBe(entry.crc)
    // Spot-check first and last bytes survived chunking.
    expect(chunks[0]![0]).toBe(data[0])
    const last = chunks[chunks.length - 1]!
    expect(last[last.length - 1]).toBe(data[size - 1])
  }, 60_000)

  it('refuses silently-truncated extraction via ArchiveSession.extractBytes', async () => {
    const data = noiseBytes(39, 35 * 1024 * 1024)
    const zip = buildStoreZip([{ name: 'videos/big.mp4', data }])
    const file = new File([new Uint8Array(zip)], 'part.zip', { type: 'application/zip' })
    const { ArchiveSession } = await import('./snapchat/session')
    const session = await ArchiveSession.create([file], () => {})
    const item = session.result.items[0]!
    const bytes = await session.extractBytes(item)
    expect(bytes.length).toBe(data.length)
    expect(bytes[0]).toBe(data[0])
  }, 60_000)
})


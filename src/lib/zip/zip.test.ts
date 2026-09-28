import { describe, expect, it } from 'vitest'
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import {
  bufferRangeReader,
  extractEntryBytes,
  readZipIndex,
  ZipFormatError,
} from './reader'
import { assertSafeArchivePath, OutputZipBuilder, sanitizeSegment } from './writer'
import { buildStoreZip, noiseBytes } from '../testutil/zipBuilder'

function expectBytesEqual(a: Uint8Array, b: Uint8Array) {
  expect(a.length).toBe(b.length)
  for (let i = 0; i < a.length; i++) expect(a[i]).toBe(b[i])
}

async function index(bytes: Uint8Array) {
  return readZipIndex(bufferRangeReader(bytes), bytes.length)
}

describe('readZipIndex (fflate-built archives)', () => {
  it('indexes and extracts deflate + stored entries byte-exactly', async () => {
    const photo = noiseBytes(1, 50_000)
    const zip = zipSync({
      'json/memories_history.json': strToU8('{"Saved Media":[]}'),
      'memories/2023-08-14_19-32-05_photo.jpg': photo,
      'readme.txt': strToU8('hello'),
    })
    const { entries, totalUncompressed } = await index(zip)
    const names = entries.map((e) => e.name)
    expect(names).toContain('json/memories_history.json')
    expect(names).toContain('memories/2023-08-14_19-32-05_photo.jpg')
    expect(totalUncompressed).toBeGreaterThan(50_000)

    const photoEntry = entries.find((e) => e.name.endsWith('photo.jpg'))!
    expect(photoEntry.size).toBe(photo.length)
    const extracted = await extractEntryBytes(bufferRangeReader(zip), photoEntry)
    expectBytesEqual(extracted, photo)

    const jsonEntry = entries.find((e) => e.name.endsWith('.json'))!
    expect(strFromU8(await extractEntryBytes(bufferRangeReader(zip), jsonEntry))).toBe(
      '{"Saved Media":[]}',
    )
  })

  it('reads entry modification times from DOS fields', async () => {
    const mtime = new Date(Date.UTC(2021, 5, 23, 15, 34, 0))
    const zip = buildStoreZip([{ name: 'a/b.jpg', data: noiseBytes(2, 100), mtime }])
    const { entries } = await index(zip)
    expect(entries[0]!.mtimeMs).toBe(mtime.getTime())
  })

  it('parses an empty zip', async () => {
    const zip = buildStoreZip([])
    const { entries } = await index(zip)
    expect(entries).toHaveLength(0)
  })
})

describe('readZipIndex (hand-built edge cases)', () => {
  it('supports zip64 entries and zip64 EOCD', async () => {
    const data = noiseBytes(3, 10_000)
    const zip = buildStoreZip([
      { name: 'big/video.mp4', data, forceZip64: true },
      { name: 'small.jpg', data: noiseBytes(4, 10) },
    ])
    const { entries } = await index(zip)
    expect(entries).toHaveLength(2)
    const vid = entries.find((e) => e.name === 'big/video.mp4')!
    expect(vid.size).toBe(data.length)
    const extracted = await extractEntryBytes(bufferRangeReader(zip), vid)
    expectBytesEqual(extracted, data)
  })

  it('supports data-descriptor entries (sizes come from the central directory)', async () => {
    const data = noiseBytes(5, 5_000)
    const zip = buildStoreZip([{ name: 'dd.jpg', data, dataDescriptor: true }])
    const { entries } = await index(zip)
    expect(entries[0]!.size).toBe(data.length)
    const extracted = await extractEntryBytes(bufferRangeReader(zip), entries[0]!)
    expectBytesEqual(extracted, data)
  })

  it('rejects non-zip input with a friendly error', async () => {
    const notZip = new TextEncoder().encode('definitely not a zip file, just text')
    await expect(index(notZip)).rejects.toThrow(ZipFormatError)
    await expect(index(new Uint8Array(10))).rejects.toThrow(/too small/)
  })

  it('rejects entries with the encrypted flag set at extraction time', async () => {
    const zip = buildStoreZip([
      { name: 'secret.jpg', data: noiseBytes(6, 100), encryptedFlag: true },
    ])
    const { entries } = await index(zip)
    await expect(
      extractEntryBytes(bufferRangeReader(zip), entries[0]!),
    ).rejects.toThrow(/password-protected/)
  })

  it('rejects unsupported compression methods at extraction time', async () => {
    const zip = buildStoreZip([{ name: 'weird.bin', data: noiseBytes(7, 100), method: 12 }])
    const { entries } = await index(zip)
    await expect(
      extractEntryBytes(bufferRangeReader(zip), entries[0]!),
    ).rejects.toThrow(/unsupported compression/)
  })

  it('rejects truncated/corrupt deflate payloads', async () => {
    const real = zipSync({ 'x.jpg': noiseBytes(8, 20_000) })
    const zip = buildStoreZip([
      { name: 'x.jpg', data: noiseBytes(8, 20_000), cdSizeOverride: 4 },
    ])
    // Same entry name, but the hand-built fixture's deflate stream is actually
    // stored bytes; instead corrupt a real deflate stream directly:
    const corrupt = real.slice()
    // find compressed data after local header (30 + name len 'x.jpg'=5 => 35)
    corrupt[40]! ^= 0xff
    corrupt[41]! ^= 0xff
    corrupt[42]! ^= 0xff
    const { entries } = await index(corrupt)
    await expect(
      extractEntryBytes(bufferRangeReader(corrupt), entries[0]!),
    ).rejects.toThrow(ZipFormatError)
    // and the lying-size fixture must also fail, not crash
    const { entries: lying } = await index(zip)
    await expect(
      extractEntryBytes(bufferRangeReader(zip), lying[0]!),
    ).rejects.toThrow(ZipFormatError)
  })
})

describe('OutputZipBuilder', () => {
  it('produces an archive that standard tools and our reader agree on', async () => {
    const builder = new OutputZipBuilder()
    const mtime = new Date(Date.UTC(2020, 11, 21, 12, 18, 40))
    await builder.add('Snapchat Memories/2020/2020-12-21_12-18-40_photo.jpg', noiseBytes(9, 30_000), mtime)
    await builder.add('Snapchat Memories/2021/2021-01-01_00-00-00_video.mp4', noiseBytes(10, 2048))
    const blob = await builder.finish()
    expect(builder.count).toBe(2)

    const bytes = new Uint8Array(await blob.arrayBuffer())
    // fflate must be able to read it back, byte-exactly
    const unzipped = unzipSync(bytes)
    expect(Object.keys(unzipped)).toHaveLength(2)
    expect(unzipped['Snapchat Memories/2020/2020-12-21_12-18-40_photo.jpg']!.length).toBe(30_000)

    // our reader must agree, including the stored mtime
    const { entries } = await index(bytes)
    const photo = entries.find((e) => e.name.endsWith('photo.jpg'))!
    expect(photo.mtimeMs).toBe(mtime.getTime())
    const extracted = await extractEntryBytes(bufferRangeReader(bytes), photo)
    expect(extracted.length).toBe(30_000)
  })
})

describe('path safety', () => {
  it('assertSafeArchivePath rejects traversal and absolute paths', () => {
    expect(() => assertSafeArchivePath('../evil.jpg')).toThrow()
    expect(() => assertSafeArchivePath('a/../../evil.jpg')).toThrow()
    expect(() => assertSafeArchivePath('/abs.jpg')).toThrow()
    expect(() => assertSafeArchivePath('a//b.jpg')).toThrow()
    expect(() => assertSafeArchivePath('ok/with\0nul.jpg')).toThrow()
    expect(() => assertSafeArchivePath('Snapchat Memories/2020/2020-01-01_photo.jpg')).not.toThrow()
  })

  it('sanitizeSegment strips filesystem-hostile characters', () => {
    expect(sanitizeSegment('my:photo?.jpg')).toBe('my_photo_.jpg')
    expect(sanitizeSegment('..hidden')).toBe('hidden')
    expect(sanitizeSegment('trailing... ')).toBe('trailing')
    expect(sanitizeSegment('CON')).toBe('_CON')
    expect(sanitizeSegment('')).toBe('file')
    expect(sanitizeSegment('a\\b/c*d?e"f<g>h|i')).toBe('a_b_c_d_e_f_g_h_i')
    expect(sanitizeSegment('x'.repeat(500)).length).toBeLessThanOrEqual(160)
  })
})

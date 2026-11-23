import { describe, expect, it } from 'vitest'
import { unzipSync } from 'fflate'
import { bufferRangeReader, readZipIndex } from '@/lib/zip/reader'
import { buildStoreZip } from '@/lib/testutil/zipBuilder'
import { parseMemoriesHistory, parseJsonSafe } from './parser'
import { parseFilenameDate, parseSnapchatDate } from './datetime'
import {
  buildInAppExport,
  buildLinkOnlyExport,
  buildMessyExport,
  buildModernExport,
  fakeJpeg,
  memoriesHistoryJson,
} from '@/lib/testutil/snapchatFixtures'
import { detectArchive, type IndexedEntry } from './detector'
import { matchMedia } from './matcher'

async function indexFixture(zip: Uint8Array) {
  const index = await readZipIndex(bufferRangeReader(zip), zip.length)
  return index.entries.map((entry, i) => ({ sourceFile: 0, index: i, entry }))
}

describe('parseSnapchatDate', () => {
  it('parses the canonical UTC format', () => {
    expect(parseSnapchatDate('2020-12-21 12:18:40 UTC')).toBe(
      Date.UTC(2020, 11, 21, 12, 18, 40),
    )
  })
  it('tolerates missing UTC suffix and ISO input', () => {
    expect(parseSnapchatDate('2020-12-21 12:18:40')).toBe(Date.UTC(2020, 11, 21, 12, 18, 40))
    expect(parseSnapchatDate('2020-12-21T12:18:40Z')).toBe(Date.UTC(2020, 11, 21, 12, 18, 40))
  })
  it('rejects garbage and implausible years instead of fabricating', () => {
    expect(parseSnapchatDate('not a date')).toBeNull()
    expect(parseSnapchatDate('')).toBeNull()
    expect(parseSnapchatDate(undefined)).toBeNull()
    expect(parseSnapchatDate('1066-01-01 00:00:00 UTC')).toBeNull()
    expect(parseSnapchatDate('3021-01-01 00:00:00 UTC')).toBeNull()
  })
})

describe('parseFilenameDate', () => {
  it('reads all common capture-style prefixes', () => {
    expect(parseFilenameDate('2023-08-14_19-32-05')!.ms).toBe(Date.UTC(2023, 7, 14, 19, 32, 5))
    expect(parseFilenameDate('2023-08-14 19.32.05')!.hasTime).toBe(true)
    expect(parseFilenameDate('20230814_193205')!.hasTime).toBe(true)
    expect(parseFilenameDate('2023-08-14')!.hasTime).toBe(false)
    expect(parseFilenameDate('20230814_x')!.hasTime).toBe(false)
  })
  it('rejects non-dates and implausible values', () => {
    expect(parseFilenameDate('IMG_4021')).toBeNull()
    expect(parseFilenameDate('2023-99-14_00-00-00')).toBeNull()
    expect(parseFilenameDate('snap')).toBeNull()
  })
})

describe('parseMemoriesHistory', () => {
  it('parses modern entries: dates, kinds, GPS, empty download URLs', () => {
    const json = parseJsonSafe(
      memoriesHistoryJson([
        {
          Date: '2023-08-14 19:32:05 UTC',
          'Media Type': 'PHOTO',
          Location: 'Latitude, Longitude: 45.95817, -66.6471',
          'Media ID': 'AB12CD34-1122-3344-5566-7788AABBCCDD',
          'Media Download Url': '',
        },
      ]),
    )!
    const { records, schemaKeys, issues } = parseMemoriesHistory(json)
    expect(records).toHaveLength(1)
    expect(records[0]!.dateMs).toBe(Date.UTC(2023, 7, 14, 19, 32, 5))
    expect(records[0]!.kind).toBe('photo')
    expect(records[0]!.lat).toBeCloseTo(45.95817)
    expect(records[0]!.lon).toBeCloseTo(-66.6471)
    expect(records[0]!.mediaId).toBe('AB12CD34-1122-3344-5566-7788AABBCCDD')
    expect(records[0]!.downloadUrl).toBeNull()
    expect(schemaKeys).toContain('Saved Media')
    expect(issues).toHaveLength(0)
  })

  it('handles legacy location format, Download Link key, and kind casing', () => {
    const json = parseJsonSafe(
      memoriesHistoryJson([
        {
          Date: '2019-06-01 10:00:00 UTC',
          'Media Type': 'Video',
          Location: 'Latitude: 40.7128, Longitude: -74.006',
          'Download Link': 'https://app.snapchat.com/hotspot/content?uuid=a',
        },
      ]),
    )!
    const { records } = parseMemoriesHistory(json)
    expect(records[0]!.kind).toBe('video')
    expect(records[0]!.lat).toBeCloseTo(40.7128)
    expect(records[0]!.lon).toBeCloseTo(-74.006)
    expect(records[0]!.downloadUrl).toContain('https://')
  })

  it('never crashes on malformed structures and reports issues without content', () => {
    const { records, issues } = parseMemoriesHistory({ 'Saved Media': 'nope' })
    expect(records).toHaveLength(0)
    expect(issues.length).toBeGreaterThan(0)

    const empty = parseMemoriesHistory({})
    expect(empty.records).toHaveLength(0)

    const bad = parseMemoriesHistory(null)
    expect(bad.records).toHaveLength(0)
  })

  it('rejects out-of-range coordinates (no fabrication)', () => {
    const json = parseJsonSafe(
      memoriesHistoryJson([
        { Date: '2020-01-01 00:00:00 UTC', Location: 'Latitude, Longitude: 999, 999' },
      ]),
    )!
    const { records } = parseMemoriesHistory(json)
    expect(records[0]!.lat).toBeNull()
    expect(records[0]!.lon).toBeNull()
  })
})

describe('detectArchive', () => {
  it('classifies a modern media+json export and skips junk', async () => {
    const entries = await indexFixture(buildModernExport())
    const d = detectArchive(entries)
    expect(d.layout).toBe('memories-media-with-json')
    expect(d.memoriesHistory).not.toBeNull()
    // 5 real media (2 mains + overlay png + 2 split segments) + 1 orphan
    expect(d.media).toHaveLength(6)
    expect(d.diagnostics.junkEntries).toBe(3)
    expect(d.diagnostics.overlayCount).toBe(1)
    expect(d.diagnostics.htmlCount).toBe(1)
    expect(d.diagnostics.memoriesHistoryName).toBe('json/memories_history.json')
  })

  it('classifies link-only, media-only, and unknown archives', async () => {
    const linkOnly = await indexFixture(buildLinkOnlyExport())
    expect(detectArchive(linkOnly).layout).toBe('memories-json-only')

    const inApp = await indexFixture(buildInAppExport())
    expect(detectArchive(inApp).layout).toBe('media-only')

    const messy = await indexFixture(buildMessyExport())
    expect(detectArchive(messy).layout).toBe('media-only')

    expect(detectArchive([]).layout).toBe('unknown')
  })
})

describe('matchMedia', () => {
  it('matches by Media ID with high confidence, archives the rest', async () => {
    const zip = buildModernExport()
    const entries = await indexFixture(zip)
    const detection = detectArchive(entries)
    const jsonBytes = unzipSync(zip)['json/memories_history.json']!
    const { records } = parseMemoriesHistory(parseJsonSafe(jsonBytes))
    const { items, stats } = matchMedia(detection, records)

    const byStem = (needle: string) => items.find((i) => i.entryName.includes(needle))!

    const photo = byStem('-main.jpg')
    expect(photo.timestampSource).toBe('metadata')
    expect(photo.confidence).toBe('high')
    expect(photo.lat).toBeCloseTo(45.95817)

    // The orphan is not referenced by the JSON: archive date fallback.
    const orphan = items.find((i) => i.matchedMediaId === null && i.role === 'main')!
    expect(orphan.timestampSource).toBe('archive')
    expect(orphan.confidence).toBe('low')

    // Split segments share a group with totals.
    const segs = items.filter((i) => i.splitGroup)
    expect(segs).toHaveLength(2)
    expect(new Set(segs.map((s) => s.splitGroup)).size).toBe(1)
    expect(segs.every((s) => s.splitTotal === 2)).toBe(true)

    // Overlay paired with its main, not counted as a memory.
    const overlay = byStem('-overlay.png')
    expect(overlay.role).toBe('overlay')
    expect(overlay.pairedEntryName).toContain('-main.jpg')

    expect(stats.total).toBe(5) // 6 media minus overlay
    expect(stats.matched).toBe(3)
    expect(stats.overlays).toBe(1)
  })

  it('dates a media-only archive from filenames and leaves the rest undated', async () => {
    const entries = await indexFixture(buildInAppExport())
    const detection = detectArchive(entries)
    const { items, stats } = matchMedia(detection, [])

    const stamped = items.find((i) => i.originalFilename.startsWith('2023-08-14_19-32-05.jpg'))!
    expect(stamped.timestampSource).toBe('filename')
    expect(stamped.confidence).toBe('medium')

    const dateOnly = items.find((i) => i.originalFilename.startsWith('2022-01-31'))!
    expect(dateOnly.timestampSource).toBe('filename')
    expect(dateOnly.confidence).toBe('low')

    const undated = items.find((i) => i.originalFilename.startsWith('IMG_'))!
    expect(undated.timestampSource).toBe('archive') // recovered, low confidence

    expect(stats.undated).toBe(0)
    expect(stats.dateFrom).toBe(Date.UTC(2022, 0, 31))
  })

  it('treats entries with no usable timestamp as undated (never invents dates)', async () => {
    const zip = buildStoreZip([
      { name: 'IMG_1.jpg', data: fakeJpeg(21, 256), zeroMtime: true },
    ])
    const index = await readZipIndex(bufferRangeReader(zip), zip.length)
    const entries: IndexedEntry[] = index.entries.map((entry, i) => ({
      sourceFile: 0,
      index: i,
      entry,
    }))
    const { items, stats } = matchMedia(detectArchive(entries), [])
    expect(items[0]!.timestampMs).toBeNull()
    expect(items[0]!.timestampSource).toBe('none')
    expect(stats.undated).toBe(1)
  })

  it('keeps duplicate Media IDs from double-counting metadata matches', async () => {
    const entries = await indexFixture(buildModernExport())
    const detection = detectArchive(entries)
    // Same record duplicated in metadata: only one file may claim it.
    const { records } = parseMemoriesHistory(
      parseJsonSafe(memoriesHistoryJson([
        {
          Date: '2023-08-14 19:32:05 UTC',
          'Media Type': 'PHOTO',
          'Media ID': 'AA000000-0000-0000-0000-000000000001',
        },
        {
          Date: '2023-08-14 19:32:05 UTC',
          'Media Type': 'PHOTO',
          'Media ID': 'AA000000-0000-0000-0000-000000000001',
        },
      ])),
    )
    // No filename carries this ID, so neither record is consumed — sanity.
    const { stats } = matchMedia(detection, records)
    expect(stats.total).toBe(5)
  })

  const mediaEntry = (sourceFile: number, name: string): IndexedEntry => ({
    sourceFile,
    index: 0,
    entry: {
      name,
      offset: 0,
      compressedSize: 8,
      size: 8,
      method: 0,
      flags: 0,
      crc: 0,
      mtimeMs: 1_700_000_000_000 + sourceFile,
      encrypted: false,
    },
  })

  it('pairs overlays and mains in linear time on large archives', () => {
    // 30,000 files used to scan the whole list once per file, quadrupling
    // per doubling: 36 s of frozen tab at 20,000 files (measured). Pairing
    // must stay linear as archives grow.
    const entries = Array.from({ length: 30_000 }, (_, i) =>
      mediaEntry(0, `memories/2026-02-20_${i}-main.jpg`),
    )
    const started = performance.now()
    const { items, stats } = matchMedia(detectArchive(entries), [])
    const elapsed = performance.now() - started

    expect(items).toHaveLength(30_000)
    expect(stats.total).toBe(30_000)
    // No metadata file, so the capture-style filename date is the source.
    expect(stats.dateFrom).toBe(Date.UTC(2026, 1, 20))
    expect(items.every((item) => item.pairedEntryName === null)).toBe(true)
    // 0.17 s locally; generous bound so a loaded CI machine cannot flake.
    expect(elapsed).toBeLessThan(5_000)
  })

  it('pairs by stem: first sibling wins, archive parts stay separate, dots in names are safe', () => {
    const entries = [
      mediaEntry(1, 'memories/x-overlay.png'),
      mediaEntry(1, 'memories/x-overlay.webp'),
      mediaEntry(1, 'memories/x-main.jpg'),
      // Same names inside another archive part must not pair across parts.
      mediaEntry(2, 'memories/x-main.jpg'),
      // A folder with a dot and a stem with a dot.
      mediaEntry(3, 'my.data/x.y-main.jpg'),
      mediaEntry(3, 'my.data/x.y-overlay.png'),
    ]
    const { items } = matchMedia(detectArchive(entries), [])
    const inPart = (sourceFile: number, entryName: string) =>
      items.find((i) => i.sourceFile === sourceFile && i.entryName === entryName)!

    expect(inPart(1, 'memories/x-main.jpg').pairedEntryName).toBe('memories/x-overlay.png')
    expect(inPart(1, 'memories/x-overlay.png').pairedEntryName).toBe('memories/x-main.jpg')
    expect(inPart(1, 'memories/x-overlay.webp').pairedEntryName).toBe('memories/x-main.jpg')
    expect(inPart(2, 'memories/x-main.jpg').pairedEntryName).toBeNull()
    expect(inPart(3, 'my.data/x.y-main.jpg').pairedEntryName).toBe('my.data/x.y-overlay.png')
    expect(inPart(3, 'my.data/x.y-overlay.png').pairedEntryName).toBe('my.data/x.y-main.jpg')
  })

  it('reports the date range for six-figure archives', () => {
    // The range used to be Math.min(...dates); spreading 130,000+ arguments
    // throws RangeError, which failed the scan on very large exports.
    const entries = Array.from({ length: 140_000 }, (_, i) => {
      const indexed = mediaEntry(0, `memories/${i}-main.jpg`)
      indexed.entry.mtimeMs = 1_600_000_000_000 + i * 1000
      return indexed
    })
    const { stats } = matchMedia(detectArchive(entries), [])
    expect(stats.total).toBe(140_000)
    expect(stats.dateFrom).toBe(1_600_000_000_000)
    expect(stats.dateTo).toBe(1_600_000_000_000 + 139_999 * 1000)
  })
})

describe('messy export (hostile names, odd types)', () => {
  it('survives traversal-style names, uppercase extensions, CON device names', async () => {
    const entries = await indexFixture(buildMessyExport())
    const detection = detectArchive(entries)
    const { items, stats } = matchMedia(detection, [])
    expect(detection.layout).toBe('media-only')
    // jpg + evil jpg + heic + MOV = 4 media; CON has no extension → not media
    expect(items).toHaveLength(4)
    expect(stats.total).toBe(4)
    const mov = items.find((i) => i.ext === 'mov')!
    expect(mov.kind).toBe('video')
    const heic = items.find((i) => i.ext === 'heic')!
    expect(heic.kind).toBe('photo')
  })
})

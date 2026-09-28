import { describe, expect, it } from 'vitest'
import { unzipSync } from 'fflate'
import { ArchiveSession } from '@/lib/snapchat/session'
import { buildPlan, DEFAULT_PLAN_OPTIONS } from '@/lib/snapchat/plan'
import { exportPlan } from '@/lib/export/exporter'
import { buildExportReport } from '@/lib/export/report'
import { readExifDateTimeOriginal } from '@/lib/media/jpeg'
import { readMp4CreationDate } from '@/lib/media/mp4'
import { readZipIndex, bufferRangeReader } from '@/lib/zip/reader'
import {
  buildInAppExport,
  buildLinkOnlyExport,
  buildModernExport,
  fakeJpeg,
} from '@/lib/testutil/snapchatFixtures'

async function scan(zip: Uint8Array, name = 'mydata.zip') {
  const file = new File([new Uint8Array(zip)], name, { type: 'application/zip' })
  return ArchiveSession.create([file], () => {})
}

describe('Easy Mode end-to-end (synthetic modern export)', () => {
  it('scans, plans, exports a clean archive with spec-format filenames', async () => {
    const source = buildModernExport()
    const session = await scan(source)

    expect(session.result.layout).toBe('memories-media-with-json')
    expect(session.result.stats.total).toBe(5)
    expect(session.result.stats.matched).toBe(3)
    expect(session.result.diagnostics.memoriesHistoryName).toBe('json/memories_history.json')

    const plan = buildPlan(session.result.items, DEFAULT_PLAN_OPTIONS)
    const paths = plan.entries.map((e) => e.path).sort()
    expect(paths).toContain('Snapchat Memories/2023/2023-08-14_19-32-05_photo.jpg')
    expect(paths).toContain('Snapchat Memories/2023/2023-08-14_19-32-11_video.mp4')
    // Undated nothing: all matched or archive-dated
    expect(plan.collisions).toBe(0)

    const outcome = await exportPlan(session, plan, {
      extraFiles: [
        {
          path: 'snapchat-export-report.json',
          bytes: buildExportReport(plan, session, { ...DEFAULT_PLAN_OPTIONS }),
        },
      ],
      writeback: { dates: true, gps: true },
    })
    expect(outcome.failures).toHaveLength(0)
    expect(outcome.blob).not.toBeNull()
    const outZip = new Uint8Array(await outcome.blob!.arrayBuffer())
    const unzipped = unzipSync(outZip)
    expect(Object.keys(unzipped)).toHaveLength(plan.entries.length + 1) // + report

    // Write-back: photos carry EXIF capture dates + GPS, videos carry
    // QuickTime creation dates — what Google/Apple Photos read on import.
    const outPhoto =
      unzipped['Snapchat Memories/2023/2023-08-14_19-32-05_photo.jpg']!
    expect(readExifDateTimeOriginal(outPhoto)).toBe(Date.UTC(2023, 7, 14, 19, 32, 5))
    const outVideo =
      unzipped['Snapchat Memories/2023/2023-08-14_19-32-11_video.mp4']!
    expect(readMp4CreationDate(outVideo)).toBe(Date.UTC(2023, 7, 14, 19, 32, 11))
    const original = fakeJpeg(1)
    expect(outPhoto.length).toBeGreaterThan(original.length) // EXIF added, pixels intact

    // The source archive bytes are untouched (we never wrote to them)
    expect(source[0]).toBe(0x50) // still a valid zip signature

    // Output entry mtimes carry the capture date (UTC decode). DOS time is
    // 2-second resolution, so :05 stores as :04.
    const outIndex = await readZipIndex(bufferRangeReader(outZip), outZip.length)
    const photoEntry = outIndex.entries.find((e) => e.name.endsWith('photo.jpg'))!
    expect(photoEntry.mtimeMs).toBe(Date.UTC(2023, 7, 14, 19, 32, 4))

    // Report is included and contains no GPS by default
    const report = JSON.parse(
      new TextDecoder().decode(unzipped['snapchat-export-report.json']!),
    )
    expect(report.stats.total).toBe(5)
    expect(report.files[0]).not.toHaveProperty('lat')
  })

  it('handles the in-app export (media-only, filename dates)', async () => {
    const session = await scan(buildInAppExport(), 'memories.zip')
    expect(session.result.layout).toBe('media-only')
    expect(session.result.stats.total).toBe(4)
    const plan = buildPlan(session.result.items, DEFAULT_PLAN_OPTIONS)
    const paths = plan.entries.map((e) => e.path)
    expect(paths).toContain('Snapchat Memories/2023/2023-08-14_19-32-05_photo.jpg')
    // Every file recovered a date (filename or archive), none invented
    expect(
      session.result.items.every((i) => i.timestampSource !== 'none' || i.mtimeMs === 0),
    ).toBe(true)
  })

  it('explains link-only exports instead of failing', async () => {
    const session = await scan(buildLinkOnlyExport())
    expect(session.result.layout).toBe('memories-json-only')
    expect(session.result.metadataCount).toBe(2)
    expect(session.result.stats.total).toBe(0)
  })
})

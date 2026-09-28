import { describe, expect, it } from 'vitest'
import { generateFilename, uniquifyPaths, DEFAULT_TEMPLATE } from './rename'
import { buildPlan, DEFAULT_PLAN_OPTIONS } from './plan'
import { folderFor, folderTreePreview } from './folders'
import type { MediaItem } from './types'

function makeItem(overrides: Partial<MediaItem>): MediaItem {
  return {
    id: '0:x',
    sourceFile: 0,
    entryName: 'memories/x.jpg',
    originalFilename: 'x.jpg',
    ext: 'jpg',
    kind: 'photo',
    size: 100,
    mtimeMs: Date.UTC(2024, 0, 1),
    role: 'main',
    pairedEntryName: null,
    splitGroup: null,
    splitIndex: null,
    splitTotal: null,
    timestampMs: Date.UTC(2023, 7, 14, 19, 32, 5),
    timestampSource: 'metadata',
    confidence: 'high',
    matchedMediaId: null,
    metadataIndex: null,
    lat: null,
    lon: null,
    downloadUrl: null,
    ...overrides,
  }
}

describe('generateFilename', () => {
  it('produces the spec default: YYYY-MM-DD_HH-MM-SS_type.ext', () => {
    const item = makeItem({})
    expect(generateFilename(item, DEFAULT_TEMPLATE, 1)).toBe('2023-08-14_19-32-05_photo.jpg')
  })

  it('never fabricates dates for undated items', () => {
    const item = makeItem({ timestampMs: null, timestampSource: 'none', ext: 'mp4', kind: 'video' })
    expect(generateFilename(item, DEFAULT_TEMPLATE, 42)).toBe('undated_video_000042.mp4')
  })

  it('supports every documented token and drops empty values cleanly', () => {
    const item = makeItem({ matchedMediaId: 'AB12CD34-0000-0000-0000-000000000001' })
    const out = generateFilename(
      item,
      '{year}-{month}-{day}_{hour}.{minute}.{second}_{type}_{id}_{index}',
      7,
    )
    expect(out).toBe('2023-08-14_19.32.05_photo_ab12cd34-0000-0000-0000-000000000001_000007.jpg')
    const empty = generateFilename(makeItem({}), '{date}_{id}_{caption}_{type}', 1)
    expect(empty).toBe('2023-08-14_photo.jpg')
  })

  it('sanitizes hostile originals when using the {original} token', () => {
    const item = makeItem({
      originalFilename: 'my:evil<name>?.jpg',
      timestampMs: Date.UTC(2023, 7, 14, 19, 32, 5),
    })
    const out = generateFilename(item, '{original}', 1)
    expect(out).toBe('my_evil_name.jpg')
  })

  it('keeps the true extension even for unusual types', () => {
    const item = makeItem({ ext: 'heic', kind: 'photo' })
    expect(generateFilename(item, DEFAULT_TEMPLATE, 1)).toBe('2023-08-14_19-32-05_photo.heic')
  })
})

describe('uniquifyPaths', () => {
  it('adds _2, _3 suffixes on collisions (spec example)', () => {
    const out = uniquifyPaths([
      'r/2023/2023-08-14_19-32-05_photo.jpg',
      'r/2023/2023-08-14_19-32-05_photo.jpg',
      'r/2023/2023-08-14_19-32-05_photo.jpg',
    ])
    expect(out).toEqual([
      'r/2023/2023-08-14_19-32-05_photo.jpg',
      'r/2023/2023-08-14_19-32-05_photo_2.jpg',
      'r/2023/2023-08-14_19-32-05_photo_3.jpg',
    ])
  })

  it('is case-insensitive across folders and handles extensionless files', () => {
    const out = uniquifyPaths(['r/A.JPG', 'r/a.jpg', 'r/README', 'r/README'])
    expect(out[0]).toBe('r/A.JPG')
    expect(out[1]).toBe('r/a_2.jpg')
    expect(out[2]).toBe('r/README')
    expect(out[3]).toBe('r/README_2')
  })
})

describe('folderFor', () => {
  it('covers all strategies including undated', () => {
    const dated = makeItem({ timestampMs: Date.UTC(2023, 7, 14, 19, 32, 5) })
    const video = makeItem({ kind: 'video', ext: 'mp4' })
    const undated = makeItem({ timestampMs: null, timestampSource: 'none' })

    expect(folderFor(dated, 'year')).toBe('2023')
    expect(folderFor(dated, 'year-month')).toBe('2023/2023-08')
    expect(folderFor(dated, 'type')).toBe('Photos')
    expect(folderFor(video, 'type')).toBe('Videos')
    expect(folderFor(video, 'year-type')).toBe('2023/Videos')
    expect(folderFor(dated, 'flat')).toBe('')
    expect(folderFor(undated, 'year')).toBe('Undated')
  })
})

describe('buildPlan (Easy Mode defaults)', () => {
  it('organizes by year under Snapchat Memories, excluding overlays', () => {
    const main = makeItem({ entryName: 'memories/a-main.jpg', originalFilename: 'a-main.jpg' })
    const overlay = makeItem({
      role: 'overlay',
      entryName: 'memories/a-overlay.png',
      originalFilename: 'a-overlay.png',
      ext: 'png',
    })
    const video2024 = makeItem({
      kind: 'video',
      ext: 'mp4',
      timestampMs: Date.UTC(2024, 1, 2, 3, 4, 5),
      entryName: 'memories/b.mp4',
      originalFilename: 'b.mp4',
    })
    const plan = buildPlan([main, overlay, video2024], DEFAULT_PLAN_OPTIONS)

    expect(plan.entries.map((e) => e.path).sort()).toEqual([
      'Snapchat Memories/2023/2023-08-14_19-32-05_photo.jpg',
      'Snapchat Memories/2024/2024-02-02_03-04-05_video.mp4',
    ])
    expect(plan.skipped).toHaveLength(1) // overlay
    expect(plan.collisions).toBe(0)
  })

  it('resolves collisions inside one year folder and reports them', () => {
    const a = makeItem({ timestampMs: Date.UTC(2023, 7, 14, 19, 32, 5) })
    const b = makeItem({ timestampMs: Date.UTC(2023, 7, 14, 19, 32, 5) })
    const plan = buildPlan([a, b], DEFAULT_PLAN_OPTIONS)
    expect(plan.entries[0]!.path).toBe('Snapchat Memories/2023/2023-08-14_19-32-05_photo.jpg')
    expect(plan.entries[1]!.path).toBe('Snapchat Memories/2023/2023-08-14_19-32-05_photo_2.jpg')
    expect(plan.collisions).toBe(1)
  })

  it('can keep only the first segment of split videos', () => {
    const s0 = makeItem({ splitGroup: 'g', splitIndex: 0, splitTotal: 2 })
    const s1 = makeItem({ splitGroup: 'g', splitIndex: 1, splitTotal: 2 })
    const keep = buildPlan([s0, s1], { ...DEFAULT_PLAN_OPTIONS, includeSplitSegments: false })
    expect(keep.entries).toHaveLength(1)
    const all = buildPlan([s0, s1], DEFAULT_PLAN_OPTIONS)
    expect(all.entries).toHaveLength(2)
  })
})

describe('folderTreePreview', () => {
  it('summarizes destination folders with counts', () => {
    const lines = folderTreePreview(['r/2023/a.jpg', 'r/2023/b.jpg', 'r/2024/c.jpg'])
    expect(lines).toEqual(['r/2023/ (2)', 'r/2024/ (1)'])
  })
})

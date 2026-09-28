import type { MemoryMetadata, MediaItem, ScanStats } from './types'
import type { Detection, IndexedEntry } from './detector'
import {
  basename,
  extOf,
  kindOfExt,
  mediaIdOfStem,
  overlayPairStem,
  roleOfStem,
  splitSegmentOf,
  stemOf,
} from './mediaTypes'
import { parseFilenameDate } from './datetime'

/**
 * Turns raw archive entries + parsed metadata into concrete MediaItems with
 * the best available capture date.
 *
 * Date resolution order (source of truth first):
 *  1. metadata — the item's Media ID appears in memories_history.json
 *  2. filename — the filename itself starts with a capture-style date
 *     (only trusted when there is no metadata file, because 2026-era export
 *     filenames carry the *export* date, not the capture date)
 *  3. archive  — the ZIP entry's own timestamp (always treated as a guess)
 *  4. none     — left undated rather than fabricating a value
 */

export interface MatchResult {
  items: MediaItem[]
  stats: ScanStats
}

export function matchMedia(detection: Detection, records: MemoryMetadata[]): MatchResult {
  const { media } = detection
  const hasMetadata = records.length > 0

  // Index metadata by Media ID (first occurrence wins, marked used when consumed).
  const byId = new Map<string, MemoryMetadata>()
  for (const r of records) {
    if (r.mediaId && !byId.has(r.mediaId)) byId.set(r.mediaId, r)
  }
  const usedRecords = new Set<MemoryMetadata>()

  // Pair overlays with their main sibling by shared stem.
  const stemKey = (indexed: IndexedEntry) => `${indexed.sourceFile}:${indexed.entry.name}`
  const byName = new Map<string, IndexedEntry>()
  for (const m of media) byName.set(stemKey(m), m)

  const items: MediaItem[] = []
  const pending: MediaItem[] = []

  for (const indexed of media) {
    const { entry, sourceFile } = indexed
    const base = basename(entry.name)
    const ext = extOf(entry.name)
    const stem = stemOf(entry.name)
    const role = roleOfStem(stem) === 'overlay' ? 'overlay' : 'main'
    const split = splitSegmentOf(stem)
    const mediaId = mediaIdOfStem(stem)

    const record = mediaId && byId.has(mediaId) && !usedRecords.has(byId.get(mediaId)!)
      ? byId.get(mediaId)!
      : null

    const item: MediaItem = {
      id: `${sourceFile}:${entry.name}`,
      sourceFile,
      entryName: entry.name,
      originalFilename: base,
      ext,
      kind: kindOfExt(ext),
      size: entry.size,
      mtimeMs: Number.isFinite(entry.mtimeMs) ? entry.mtimeMs : 0,
      role,
      pairedEntryName: null,
      splitGroup: split ? `${sourceFile}:${split.base}.${ext}` : null,
      splitIndex: split?.index ?? null,
      splitTotal: null,
      timestampMs: null,
      timestampSource: 'none',
      confidence: 'low',
      matchedMediaId: record?.mediaId ?? null,
      metadataIndex: record?.index ?? null,
      lat: record?.lat ?? null,
      lon: record?.lon ?? null,
      downloadUrl: record?.downloadUrl ?? null,
    }
    if (record) {
      usedRecords.add(record)
      item.timestampMs = record.dateMs
      item.timestampSource = 'metadata'
      item.confidence = 'high'
    }
    items.push(item)
    if (item.timestampSource === 'none') pending.push(item)
  }

  // Overlay/main pairing (by name, independent of metadata). The overlay is
  // usually a PNG while the main is a JPG/MP4, so match on stem, not extension.
  const pairSiblingPath = (item: MediaItem): string | null => {
    const stem = stemOf(item.entryName)
    const pairStem = overlayPairStem(stem)
    if (!pairStem) return null
    const dirStart = item.entryName.lastIndexOf('/')
    const dir = dirStart === -1 ? '' : item.entryName.slice(0, dirStart + 1)
    return `${dir}${pairStem}.`
  }
  for (const item of items) {
    const pairPrefix = pairSiblingPath(item)
    if (!pairPrefix) continue
    const pairItem = items.find(
      (c) => c !== item && c.sourceFile === item.sourceFile && c.entryName.startsWith(pairPrefix),
    )
    if (pairItem) item.pairedEntryName = pairItem.entryName
  }

  // Resolve remaining dates.
  for (const item of pending) {
    if (!hasMetadata) {
      // Media-only archive: trust a capture-style filename date.
      const fd = parseFilenameDate(stemOf(item.entryName))
      if (fd) {
        item.timestampMs = fd.ms
        item.timestampSource = 'filename'
        item.confidence = fd.hasTime ? 'medium' : 'low'
        continue
      }
    }
    if (item.mtimeMs > 0) {
      item.timestampMs = item.mtimeMs
      item.timestampSource = 'archive'
      item.confidence = 'low'
    }
  }

  // Overlays without their own date inherit their main's (same moment).
  for (const item of items) {
    if (item.role !== 'overlay' || item.timestampSource !== 'none') continue
    const pairPrefix = pairSiblingPath(item)
    if (!pairPrefix) continue
    const pairItem = items.find(
      (c) => c !== item && c.sourceFile === item.sourceFile && c.entryName.startsWith(pairPrefix),
    )
    if (pairItem && pairItem.timestampSource !== 'none') {
      item.timestampMs = pairItem.timestampMs
      item.timestampSource = pairItem.timestampSource
      item.confidence = pairItem.confidence
    }
  }

  // Split-video group totals.
  const groupCounts = new Map<string, number>()
  for (const item of items) {
    if (item.splitGroup) groupCounts.set(item.splitGroup, (groupCounts.get(item.splitGroup) ?? 0) + 1)
  }
  for (const item of items) {
    if (item.splitGroup) item.splitTotal = groupCounts.get(item.splitGroup) ?? 1
  }

  const countable = items.filter((i) => i.role !== 'overlay')
  const dated = countable.filter((i) => i.timestampMs !== null)
  const stats: ScanStats = {
    total: countable.length,
    photos: countable.filter((i) => i.kind === 'photo').length,
    videos: countable.filter((i) => i.kind === 'video').length,
    matched: countable.filter((i) => i.timestampSource === 'metadata').length,
    archiveDated: countable.filter((i) => i.timestampSource === 'archive' || i.timestampSource === 'filename').length,
    undated: countable.filter((i) => i.timestampMs === null).length,
    overlays: items.length - countable.length,
    dateFrom: dated.length ? Math.min(...dated.map((i) => i.timestampMs!)) : null,
    dateTo: dated.length ? Math.max(...dated.map((i) => i.timestampMs!)) : null,
  }

  return { items, stats }
}

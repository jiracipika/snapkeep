import type { MediaItem, ScanStats } from './types'
import { generateFilename, uniquifyPaths } from './rename'
import { folderFor, type FolderStrategy } from './folders'

/**
 * Export planning: pure mapping from MediaItems to output archive paths.
 * Parsing, matching and naming stay separate; the exporter only sees paths.
 */

export interface PlanOptions {
  rootName: string
  folderStrategy: FolderStrategy
  filenameTemplate: string
  includeOverlays: boolean
  includeSplitSegments: boolean
}

export const DEFAULT_PLAN_OPTIONS: PlanOptions = {
  rootName: 'Snapchat Memories',
  folderStrategy: 'year',
  filenameTemplate: '{date}_{time}_{type}',
  includeOverlays: false,
  includeSplitSegments: true,
}

export interface PlannedItem {
  item: MediaItem
  /** Path inside the output ZIP, root included. */
  path: string
  filename: string
}

export interface ExportPlan {
  entries: PlannedItem[]
  skipped: MediaItem[]
  stats: ScanStats
  /** Count of names that needed a _2/_3 collision suffix. */
  collisions: number
}

function isUndated(item: MediaItem): boolean {
  return item.timestampMs === null
}

export function buildPlan(items: MediaItem[], options: PlanOptions): ExportPlan {
  const selected = items.filter((item) => {
    if (item.role === 'overlay' && !options.includeOverlays) return false
    if (!options.includeSplitSegments && item.splitGroup && (item.splitIndex ?? 0) > 0) {
      return false
    }
    return true
  })
  const skipped = items.filter((i) => !selected.includes(i))

  const root = options.rootName.trim().replace(/[/\\]+/g, '') || 'Snapchat Memories'
  const candidatePaths = selected.map((item, ordinal) => {
    const filename = generateFilename(item, options.filenameTemplate, ordinal + 1)
    const dir = folderFor(item, options.folderStrategy)
    return dir ? `${root}/${dir}/${filename}` : `${root}/${filename}`
  })

  const unique = uniquifyPaths(candidatePaths)
  let collisions = 0
  const entries = selected.map((item, i) => {
    const path = unique[i]!
    const filename = path.slice(path.lastIndexOf('/') + 1)
    if (filename !== candidatePaths[i]!.slice(candidatePaths[i]!.lastIndexOf('/') + 1)) {
      collisions++
    }
    return { item, path, filename }
  })

  return { entries, skipped, stats: computeStats(selected), collisions }
}

export function computeStats(items: MediaItem[]): ScanStats {
  const countable = items.filter((i) => i.role !== 'overlay')
  const dated = countable.filter((i) => i.timestampMs !== null)
  return {
    total: countable.length,
    photos: countable.filter((i) => i.kind === 'photo').length,
    videos: countable.filter((i) => i.kind === 'video').length,
    matched: countable.filter((i) => i.timestampSource === 'metadata').length,
    archiveDated: countable.filter(
      (i) => i.timestampSource === 'archive' || i.timestampSource === 'filename',
    ).length,
    undated: countable.filter((i) => isUndated(i)).length,
    overlays: items.length - countable.length,
    dateFrom: dated.length ? Math.min(...dated.map((i) => i.timestampMs!)) : null,
    dateTo: dated.length ? Math.max(...dated.map((i) => i.timestampMs!)) : null,
  }
}

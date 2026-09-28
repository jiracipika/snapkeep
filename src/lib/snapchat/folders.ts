import { formatDateParts } from './datetime'
import type { MediaItem } from './types'

export type FolderStrategy = 'flat' | 'year' | 'year-month' | 'type' | 'year-type'

export const FOLDER_STRATEGIES: { id: FolderStrategy; label: string; hint: string }[] = [
  { id: 'year', label: 'Year', hint: '2023/… — the Easy Mode default' },
  { id: 'flat', label: 'No folders', hint: 'everything in one folder' },
  { id: 'year-month', label: 'Year / Month', hint: '2023/2023-08/…' },
  { id: 'type', label: 'Photos / Videos', hint: 'two folders by media type' },
  { id: 'year-type', label: 'Year + type', hint: '2023/Photos/…' },
]

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/** Directory (no root, no filename) for an item under the given strategy. */
export function folderFor(item: MediaItem, strategy: FolderStrategy): string {
  if (strategy === 'type' && item.kind) {
    return item.kind === 'photo' ? 'Photos' : 'Videos'
  }
  if (item.timestampMs === null || strategy === 'flat') {
    return strategy === 'flat' ? '' : 'Undated'
  }
  const { year, month } = formatDateParts(item.timestampMs)
  const typeDir = item.kind === 'video' ? 'Videos' : 'Photos'
  if (strategy === 'type') return typeDir
  if (strategy === 'year-month') return `${year}/${year}-${month}`
  if (strategy === 'year-type') return `${year}/${typeDir}`
  return year
}

export function monthLabel(month: string): string {
  const idx = Number(month) - 1
  return MONTHS[idx] ?? month
}

/** Compact tree preview lines like "2019/", "2019/12 - December/", given final paths. */
export function folderTreePreview(paths: string[], maxLines = 14): string[] {
  const counts = new Map<string, number>()
  for (const p of paths) {
    const dir = p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : ''
    counts.set(dir, (counts.get(dir) ?? 0) + 1)
  }
  const lines = [...counts.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([dir, count]) => (dir === '' ? `/ (${count})` : `${dir}/ (${count})`))
  if (lines.length <= maxLines) return lines
  return [...lines.slice(0, maxLines - 1), `… and ${lines.length - maxLines + 1} more folders`]
}

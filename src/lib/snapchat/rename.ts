import { sanitizeSegment } from '@/lib/zip/writer'
import { formatDateParts } from './datetime'
import type { MediaItem } from './types'

/**
 * Filename generation. Default Easy Mode shape:
 *   2023-08-14_19-32-05_photo.jpg
 * Collisions become  …_photo_2.jpg, …_photo_3.jpg …
 *
 * Missing data is never invented: undated items become "undated_<type>_<n>"
 * and tokens without a value collapse away instead of printing placeholders.
 */

export const DEFAULT_TEMPLATE = '{date}_{time}_{type}'

export const TEMPLATE_TOKENS = [
  '{year}', '{month}', '{day}', '{date}', '{time}', '{hour}', '{minute}',
  '{second}', '{type}', '{original}', '{id}', '{index}',
] as const

export function templateVars(item: MediaItem, ordinal: number): Record<string, string> {
  const parts = item.timestampMs !== null ? formatDateParts(item.timestampMs) : null
  const type = item.kind ?? 'media'
  const uuidInName = item.matchedMediaId ?? ''
  return {
    year: parts?.year ?? 'undated',
    month: parts?.month ?? '',
    day: parts?.day ?? '',
    date: parts?.date ?? 'undated',
    time: parts?.time ?? '',
    hour: parts?.hour ?? '',
    minute: parts?.minute ?? '',
    second: parts?.second ?? '',
    type,
    original: sanitizeSegment(item.originalFilename.replace(/\.[^.]*$/, ''), 80),
    id: uuidInName.toLowerCase(),
    index: String(ordinal).padStart(6, '0'),
  }
}

export function generateFilename(item: MediaItem, template: string, ordinal: number): string {
  let name = template
  for (const [key, value] of Object.entries(templateVars(item, ordinal))) {
    name = name.split(`{${key}}`).join(value)
  }
  // Remove any leftover unknown tokens, collapse separators, tidy edges.
  name = name.replace(/\{[a-z]+\}/gi, '')
  name = name.replace(/[_\s-]*_(?:[_\s-]*_)+/g, '_')
  name = name.replace(/_{2,}/g, '_').replace(/^[_\s-]+|[_\s-]+$/g, '')
  let stem = sanitizeSegment(name, 140)
  // Undated items get a deterministic ordinal so they never collide en masse
  // and stay traceable — without inventing a date.
  if (item.timestampMs === null && !template.includes('{index}')) {
    stem = `${stem}_${String(ordinal).padStart(6, '0')}`.slice(0, 160)
  }
  const ext = item.ext ? `.${item.ext}` : ''
  return `${stem}${ext}`
}

/** Assigns unique paths for a whole batch, adding _2/_3 suffixes on collision. */
export function uniquifyPaths(paths: string[]): string[] {
  const seen = new Map<string, number>()
  const out: string[] = []
  for (const original of paths) {
    const count = seen.get(original.toLowerCase()) ?? 0
    seen.set(original.toLowerCase(), count + 1)
    if (count === 0) {
      out.push(original)
      continue
    }
    const dot = original.lastIndexOf('.')
    const slash = original.lastIndexOf('/')
    const extDot = dot > slash ? dot : original.length
    const dir = slash >= 0 ? original.slice(0, slash + 1) : ''
    const stem = original.slice(dir.length, extDot)
    const ext = original.slice(extDot)
    let candidate = ''
    let n = count + 1
    do {
      candidate = `${dir}${stem}_${n}${ext}`
      n++
    } while (seen.has(candidate.toLowerCase()) && n < 100000)
    seen.set(candidate.toLowerCase(), (seen.get(candidate.toLowerCase()) ?? 0) + 1)
    out.push(candidate)
  }
  return out
}

import type { MediaKind } from './types'

const PHOTO_EXTS = new Set(['jpg', 'jpeg', 'png', 'heic', 'heif', 'webp', 'gif', 'bmp'])
const VIDEO_EXTS = new Set(['mp4', 'mov', 'm4v', 'avi', 'webm', 'mkv', '3gp'])

export function extOf(filename: string): string {
  const dot = filename.lastIndexOf('.')
  if (dot <= 0 || dot === filename.length - 1) return ''
  return filename.slice(dot + 1).toLowerCase()
}

export function kindOfExt(ext: string): MediaKind | null {
  if (PHOTO_EXTS.has(ext)) return 'photo'
  if (VIDEO_EXTS.has(ext)) return 'video'
  return null
}

/** Archive paths that are packaging noise, never user media. */
export function isJunkPath(path: string): boolean {
  const parts = path.split('/')
  if (parts.some((p) => p === '__MACOSX' || p === '.git')) return true
  const base = parts[parts.length - 1]!
  if (base.startsWith('._')) return true // AppleDouble resource forks
  if (base === '.DS_Store' || base === 'Thumbs.db') return true
  return false
}

export function basename(path: string): string {
  const idx = path.lastIndexOf('/')
  return idx === -1 ? path : path.slice(idx + 1)
}

export function stemOf(filename: string): string {
  const base = basename(filename)
  const dot = base.lastIndexOf('.')
  return dot <= 0 ? base : base.slice(0, dot)
}

/** Snapchat's 2026-era export pairs bases and overlays by shared stem suffix. */
const OVERLAY_RE = /-overlay$/i
const MAIN_RE = /-main$/i

export function roleOfStem(stem: string): 'main' | 'overlay' | 'unknown' {
  if (OVERLAY_RE.test(stem)) return 'overlay'
  if (MAIN_RE.test(stem)) return 'main'
  return 'unknown'
}

export function overlayPairStem(stem: string): string | null {
  if (OVERLAY_RE.test(stem)) return stem.replace(OVERLAY_RE, '-main')
  if (MAIN_RE.test(stem)) return stem.replace(MAIN_RE, '-overlay')
  return null
}

const UUID_RE =
  /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/

/** Extracts a Snapchat Media ID (UUID) from a filename stem, uppercased. */
export function mediaIdOfStem(stem: string): string | null {
  const m = UUID_RE.exec(stem)
  return m ? m[0].toUpperCase() : null
}

const SPLIT_RE = /_(\d{1,3})$/

/** Detects …_0 / …_1 split-video segment suffixes. */
export function splitSegmentOf(stem: string): { base: string; index: number } | null {
  const m = SPLIT_RE.exec(stem)
  if (!m) return null
  return { base: stem.slice(0, m.index), index: +m[1] }
}

const MEMORIES_HISTORY_RE = /memories[_-]?history[^/]*\.json$/i

export function isMemoriesHistoryPath(path: string): boolean {
  return MEMORIES_HISTORY_RE.test(path)
}

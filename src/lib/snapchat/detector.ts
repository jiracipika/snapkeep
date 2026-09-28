import type { ZipEntry } from '@/lib/zip/reader'
import type { ArchiveLayout, ArchiveDiagnostics } from './types'
import {
  extOf,
  isJunkPath,
  isMemoriesHistoryPath,
  kindOfExt,
  roleOfStem,
  splitSegmentOf,
  stemOf,
} from './mediaTypes'

/** An archive entry plus which dropped file it came from (multi-part exports). */
export interface IndexedEntry {
  sourceFile: number
  index: number
  entry: ZipEntry
}

/**
 * Structure detection. Snap has changed its export layout repeatedly
 * (link-only exports until early 2026, media-in-zip since Feb 2026, download
 * URLs removed mid-2026), so nothing here assumes one exact structure.
 */
export interface Detection {
  layout: ArchiveLayout
  /** Non-junk photo/video entries, in stable order. */
  media: IndexedEntry[]
  memoriesHistory: IndexedEntry | null
  otherJson: IndexedEntry[]
  htmlCount: number
  diagnostics: ArchiveDiagnostics
}

const MAX_SAMPLE_TREE = 12

export function detectArchive(entries: IndexedEntry[]): Detection {
  const media: IndexedEntry[] = []
  const jsonCandidates: IndexedEntry[] = []
  const otherJson: IndexedEntry[] = []
  const extCounts = new Map<string, number>()
  const folderCounts = new Map<string, number>()
  const sampleFolders = new Set<string>()
  let junk = 0
  let html = 0
  let overlayCount = 0
  let memoriesHistory: IndexedEntry | null = null

  for (const indexed of entries) {
    const { entry } = indexed
    if (isJunkPath(entry.name)) {
      junk++
      continue
    }
    const ext = extOf(entry.name)

    if (ext) {
      extCounts.set(ext, (extCounts.get(ext) ?? 0) + 1)
    }
    // First-level folder tally (names only).
    const firstSegment = entry.name.includes('/')
      ? entry.name.split('/')[0]!
      : '(root)'
    folderCounts.set(firstSegment, (folderCounts.get(firstSegment) ?? 0) + 1)
    const dir = entry.name.includes('/') ? entry.name.slice(0, entry.name.lastIndexOf('/')) : ''
    if (dir && sampleFolders.size < 400) sampleFolders.add(dir)

    if (ext && kindOfExt(ext)) {
      media.push(indexed)
      if (roleOfStem(stemOf(entry.name)) === 'overlay') overlayCount++
    } else if (ext === 'json') {
      if (isMemoriesHistoryPath(entry.name)) {
        if (!memoriesHistory || entry.name.length < memoriesHistory.entry.name.length) {
          memoriesHistory = indexed
        }
        jsonCandidates.push(indexed)
      } else {
        otherJson.push(indexed)
      }
    } else if (ext === 'html' || ext === 'htm') {
      html++
    }
  }

  // Stable, deterministic order for everything downstream.
  media.sort(
    (a, b) =>
      a.sourceFile - b.sourceFile ||
      (a.entry.offset - b.entry.offset) ||
      a.entry.name.localeCompare(b.entry.name),
  )

  let layout: ArchiveLayout = 'unknown'
  const hasMedia = media.length > 0
  const hasHistory = memoriesHistory !== null
  if (hasHistory && hasMedia) layout = 'memories-media-with-json'
  else if (hasHistory) layout = 'memories-json-only'
  else if (hasMedia) layout = 'media-only'

  const splitGroups = new Set<string>()
  for (const m of media) {
    const seg = splitSegmentOf(stemOf(m.entry.name))
    if (seg) splitGroups.add(seg.base)
  }

  const diagnostics: ArchiveDiagnostics = {
    layout,
    totalEntries: entries.length,
    junkEntries: junk,
    mediaCount: media.length,
    photoCount: media.filter((m) => kindOfExt(extOf(m.entry.name)) === 'photo').length,
    videoCount: media.filter((m) => kindOfExt(extOf(m.entry.name)) === 'video').length,
    overlayCount,
    unmatchedCount: 0, // filled by the matcher
    jsonFiles: [], // filled by the scanner once parsed
    htmlCount: html,
    extensionCounts: [...extCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 24),
    folders: [...folderCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 24),
    sampleFolderTree: [...sampleFolders].sort().slice(0, MAX_SAMPLE_TREE),
    memoriesHistoryName: memoriesHistory?.entry.name ?? null,
    splitGroupCount: splitGroups.size,
  }
  void jsonCandidates

  return { layout, media, memoriesHistory, otherJson, htmlCount: html, diagnostics }
}

export function layoutLabel(layout: ArchiveLayout): string {
  switch (layout) {
    case 'memories-media-with-json':
      return 'Memories export with media and metadata'
    case 'memories-json-only':
      return 'Metadata-only export (download links, no media files)'
    case 'media-only':
      return 'Media files without Snapchat metadata'
    case 'unknown':
      return 'No Snapchat media or metadata recognized'
  }
}

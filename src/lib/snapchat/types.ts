/** Shared Snapchat domain types. No enums (TS erasableSyntaxOnly). */

export type MediaKind = 'photo' | 'video'

export type TimestampSource = 'metadata' | 'filename' | 'archive' | 'none'

export type MatchConfidence = 'high' | 'medium' | 'low'

/** One entry of the "Saved Media" array in memories_history.json. */
export interface MemoryMetadata {
  index: number
  dateMs: number | null
  kind: MediaKind | null
  /** Uppercased UUID, matches filenames in the memories/ folder. */
  mediaId: string | null
  lat: number | null
  lon: number | null
  /** Snapchat CDN link, if the export still carries one. Often empty since mid-2026. */
  downloadUrl: string | null
  /** Which JSON file it came from (multi-part exports). */
  sourceFile: number
}

export type MediaRole = 'main' | 'overlay'

export interface MediaItem {
  /** Stable id: source file index + archive entry name. */
  id: string
  sourceFile: number
  entryName: string
  originalFilename: string
  ext: string
  kind: MediaKind | null
  size: number
  mtimeMs: number
  role: MediaRole
  /** Entry name of the paired overlay/main, when a sibling exists. */
  pairedEntryName: string | null
  /** Split-video group base name (…_0, …_1 segments share a group). */
  splitGroup: string | null
  splitIndex: number | null
  splitTotal: number | null
  /** Best-known capture time and where it came from. */
  timestampMs: number | null
  timestampSource: TimestampSource
  confidence: MatchConfidence
  matchedMediaId: string | null
  metadataIndex: number | null
  lat: number | null
  lon: number | null
  downloadUrl: string | null
}

export type ArchiveLayout =
  | 'memories-media-with-json'
  | 'memories-json-only'
  | 'media-only'
  | 'unknown'

export interface JsonFileInfo {
  name: string
  entryIndex: number
  sourceFile: number
  size: number
  /** Top-level / item schema keys only — never values. */
  schemaKeys: string[]
  recordCount: number | null
}

export interface ArchiveDiagnostics {
  layout: ArchiveLayout
  totalEntries: number
  junkEntries: number
  mediaCount: number
  photoCount: number
  videoCount: number
  overlayCount: number
  unmatchedCount: number
  jsonFiles: JsonFileInfo[]
  htmlCount: number
  extensionCounts: [string, number][]
  /** Most common first-level folders, capped for display. */
  folders: [string, number][]
  /** Sampled (never dumped) folder structure depth, for the inspector. */
  sampleFolderTree: string[]
  memoriesHistoryName: string | null
  splitGroupCount: number
}

export interface ScanStats {
  total: number
  photos: number
  videos: number
  matched: number
  archiveDated: number
  undated: number
  overlays: number
  dateFrom: number | null
  dateTo: number | null
}

export interface ScanResult {
  layout: ArchiveLayout
  items: MediaItem[]
  stats: ScanStats
  /** Number of metadata records found (memories_history.json entries). */
  metadataCount: number
  diagnostics: ArchiveDiagnostics
  warnings: string[]
}

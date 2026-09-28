import {
  extractEntry,
  extractEntryBytes,
  fileRangeReader,
  readZipIndex,
  type RangeReader,
  type ZipIndex,
} from '@/lib/zip/reader'
import { detectArchive, type IndexedEntry } from './detector'
import { matchMedia } from './matcher'
import { parseJsonSafe, parseMemoriesHistory } from './parser'
import type { ArchiveDiagnostics, MemoryMetadata, ScanResult, ScanStats } from './types'
import type { MediaItem } from './types'

export type ScanStage = 'opening' | 'detecting' | 'metadata' | 'matching' | 'ready'

export interface ScanProgress {
  stage: ScanStage
  /** 0..1 within the whole scan, approximate. */
  fraction: number
  detail?: string
}

const MAX_JSON_BYTES = 128 * 1024 * 1024
const yieldToUi = () => new Promise((r) => setTimeout(r, 0))

/**
 * A scanned archive session: indexes one or more ZIP parts (multi-part
 * `mydata~*.zip` exports), finds and parses Snapchat metadata, matches it to
 * media, and keeps lazy readers around for export. Nothing is held in memory
 * except the index — media bytes are extracted on demand.
 */
export class ArchiveSession {
  readonly sources: { name: string; size: number }[]
  readonly result: ScanResult
  private readers: RangeReader[]
  private indexes: ZipIndex[]

  private constructor(
    sources: { name: string; size: number }[],
    result: ScanResult,
    readers: RangeReader[],
    indexes: ZipIndex[],
  ) {
    this.sources = sources
    this.result = result
    this.readers = readers
    this.indexes = indexes
  }

  static async create(
    files: File[],
    onProgress: (p: ScanProgress) => void,
  ): Promise<ArchiveSession> {
    const readers: RangeReader[] = []
    const indexes: ZipIndex[] = []
    const sources: { name: string; size: number }[] = []
    const warnings: string[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]!
      onProgress({
        stage: 'opening',
        fraction: (i + 0.3) / (files.length + 1),
        detail: file.name,
      })
      const reader = fileRangeReader(file)
      readers.push(reader)
      indexes.push(await readZipIndex(reader, file.size))
      sources.push({ name: file.name, size: file.size })
      await yieldToUi()
    }

    onProgress({ stage: 'detecting', fraction: 0.6 })
    const entries: IndexedEntry[] = []
    for (let s = 0; s < indexes.length; s++) {
      for (const entry of indexes[s]!.entries) {
        entries.push({ sourceFile: s, index: entries.length, entry })
      }
    }
    const detection = detectArchive(entries)
    await yieldToUi()

    // Parse memories_history.json when present (values stay out of the UI).
    let records: MemoryMetadata[] = []
    if (detection.memoriesHistory) {
      onProgress({ stage: 'metadata', fraction: 0.7 })
      const hist = detection.memoriesHistory
      if (hist.entry.size > MAX_JSON_BYTES) {
        warnings.push('The metadata file is too large to read; dates will come from filenames instead.')
      } else {
        const bytes = await extractEntryBytes(readers[hist.sourceFile]!, hist.entry)
        const parsed = parseMemoriesHistory(parseJsonSafe(bytes), hist.sourceFile)
        records = parsed.records
        warnings.push(...parsed.issues)
      }
      await yieldToUi()
    }

    onProgress({ stage: 'matching', fraction: 0.85 })
    const { items, stats } = matchMedia(detection, records)

    const jsonFiles = detection.diagnostics.jsonFiles.slice()
    if (detection.memoriesHistory) {
      const hist = detection.memoriesHistory
      jsonFiles.unshift({
        name: hist.entry.name,
        entryIndex: hist.index,
        sourceFile: hist.sourceFile,
        size: hist.entry.size,
        schemaKeys: records.length
          ? ['Saved Media', 'Date', 'Media Type', 'Location', 'Media ID']
          : ['Saved Media'],
        recordCount: records.length,
      })
    }
    for (const other of detection.otherJson.slice(0, 50)) {
      jsonFiles.push({
        name: other.entry.name,
        entryIndex: other.index,
        sourceFile: other.sourceFile,
        size: other.entry.size,
        schemaKeys: [],
        recordCount: null,
      })
    }

    const diagnostics: ArchiveDiagnostics = {
      ...detection.diagnostics,
      unmatchedCount: items.filter((i) => i.role !== 'overlay' && i.timestampSource !== 'metadata')
        .length,
      jsonFiles,
    }

    if (files.length > 1) {
      warnings.push(`${files.length} archive parts were processed as one export.`)
    }

    const result: ScanResult = {
      layout: detection.layout,
      items,
      stats: rescanStats(items, stats),
      metadataCount: records.length,
      diagnostics,
      warnings,
    }
    onProgress({ stage: 'ready', fraction: 1 })

    return new ArchiveSession(sources, result, readers, indexes)
  }

  /** Streams one item's bytes out of its source archive. */
  async extractTo(
    item: MediaItem,
    sink: (chunk: Uint8Array) => void,
  ): Promise<void> {
    const index = this.indexes[item.sourceFile]
    const reader = this.readers[item.sourceFile]
    if (!index || !reader) throw new Error(`Missing source archive for ${item.entryName}`)
    const indexed = index.entries.find((e) => e.name === item.entryName)
    if (!indexed) throw new Error(`Entry vanished from index: ${item.entryName}`)
    await extractEntry(reader, indexed, sink)
  }

  /** Extracts one item fully into memory (small items: previews, hashes). */
  async extractBytes(item: MediaItem): Promise<Uint8Array> {
    const out = new Uint8Array(item.size)
    let at = 0
    await this.extractTo(item, (chunk) => {
      out.set(chunk, at)
      at += chunk.length
    })
    if (at !== item.size) {
      throw new Error(`Entry "${item.entryName}" yielded ${at} bytes, expected ${item.size}`)
    }
    return out
  }
}

/** Recomputes stats over a possibly-filtered item list, keeping date range. */
function rescanStats(items: MediaItem[], fallback: ScanStats): ScanStats {
  const countable = items.filter((i) => i.role !== 'overlay')
  return {
    ...fallback,
    total: countable.length,
    photos: countable.filter((i) => i.kind === 'photo').length,
    videos: countable.filter((i) => i.kind === 'video').length,
    dateFrom: fallback.dateFrom,
    dateTo: fallback.dateTo,
    undated: countable.filter((i) => i.timestampMs === null).length,
    archiveDated: countable.filter(
      (i) => i.timestampSource === 'archive' || i.timestampSource === 'filename',
    ).length,
    matched: countable.filter((i) => i.timestampSource === 'metadata').length,
  }
}

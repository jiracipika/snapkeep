import { StoreZipWriter } from '@/lib/zip/writer'
import type { ArchiveSession } from '@/lib/snapchat/session'
import type { ExportPlan } from '@/lib/snapchat/plan'
import { insertExif } from '@/lib/media/jpeg'
import { patchMp4CreationDates } from '@/lib/media/mp4'

/**
 * The exporter: turns a plan into a brand-new ZIP by streaming each item out
 * of the original archive and storing it byte-identically (zip64-safe, so
 * multi-part exports over 4 GB / 65k files are fine). The user's source ZIP
 * is never modified. Per-file failures are collected, never fatal — Easy
 * Mode recovers as much as safely possible.
 *
 * Output modes:
 *  - 'stream': every output chunk flows to the caller's sink (used with the
 *    File System Access API so a 10 GB export never sits in memory).
 *  - 'blob' (fallback): chunks are collected and returned as one Blob.
 *
 * Optional metadata write-back embeds capture dates (and GPS for photos)
 * losslessly: JPEGs get a minimal EXIF APP1 splice, MP4/MOV containers get
 * their creation_time atoms patched — no pixels or video streams touched.
 */

export interface WritebackOptions {
  /** Embed capture dates (EXIF / QuickTime atoms) for Photos-app compatibility. */
  dates: boolean
  /** Additionally embed GPS coordinates in photo EXIF. */
  gps: boolean
}

export type ExportOutput =
  | { mode: 'stream'; write: (chunk: Uint8Array) => void | Promise<void> }
  | { mode: 'blob' }

export interface ExportProgress {
  phase: 'packing' | 'done'
  done: number
  total: number
  bytes: number
  failures: number
  currentName: string
}

export interface ExportOutcome {
  /** Non-null only for the 'blob' output mode. */
  blob: Blob | null
  bytes: number
  count: number
  failures: { name: string; reason: string }[]
}

export interface ExportRunOptions {
  onProgress?: (p: ExportProgress) => void
  signal?: AbortSignal
  /** Extra small files to include, e.g. the export report. */
  extraFiles?: { path: string; bytes: Uint8Array }[]
  writeback?: WritebackOptions
  output?: ExportOutput
}

/** Write-back needs the whole file in memory; stream huge videos untouched. */
const WRITEBACK_SIZE_LIMIT = 128 * 1024 * 1024

export async function exportPlan(
  session: ArchiveSession,
  plan: ExportPlan,
  options: ExportRunOptions = {},
): Promise<ExportOutcome> {
  const { onProgress, signal, extraFiles, writeback } = options

  let blobParts: BlobPart[] | null = null
  let writer: StoreZipWriter
  if (options.output?.mode === 'stream') {
    const write = options.output.write
    writer = new StoreZipWriter(write)
  } else {
    blobParts = []
    writer = new StoreZipWriter((chunk) => {
      blobParts!.push(chunk.slice())
    })
  }

  const failures: { name: string; reason: string }[] = []
  let bytes = 0
  const total = plan.entries.length

  for (let i = 0; i < total; i++) {
    if (signal?.aborted) throw new DOMException('Export cancelled', 'AbortError')
    const planned = plan.entries[i]!
    onProgress?.({
      phase: 'packing',
      done: i,
      total,
      bytes,
      failures: failures.length,
      currentName: planned.filename,
    })
    try {
      const wb = writeback
      const canWriteBack =
        wb?.dates === true &&
        planned.item.timestampMs !== null &&
        planned.item.size <= WRITEBACK_SIZE_LIMIT &&
        (planned.item.kind === 'photo' || planned.item.kind === 'video')
      if (canWriteBack) {
        const raw = await session.extractBytes(planned.item)
        let transformed = raw
        if (planned.item.kind === 'photo') {
          transformed = insertExif(raw, {
            dateMs: planned.item.timestampMs!,
            lat: wb.gps ? planned.item.lat : null,
            lon: wb.gps ? planned.item.lon : null,
          })
        } else if (
          planned.item.ext === 'mp4' ||
          planned.item.ext === 'mov' ||
          planned.item.ext === 'm4v'
        ) {
          transformed = patchMp4CreationDates(raw, planned.item.timestampMs!)
        }
        bytes += transformed.length
        await writer.add(planned.path, transformed.length, mtimeFor(planned.item), (push) => {
          push(transformed)
        })
      } else {
        const ok = await writer.add(
          planned.path,
          planned.item.size,
          mtimeFor(planned.item),
          async (push) => {
            await session.extractTo(planned.item, async (chunk) => {
              bytes += chunk.length
              await push(chunk)
            })
          },
        )
        if (!ok) {
          failures.push({
            name: planned.item.entryName,
            reason: 'could not be read completely and was padded — re-export to retry',
          })
        }
      }
    } catch (err) {
      failures.push({
        name: planned.item.entryName,
        reason: err instanceof Error ? err.message : 'unknown error',
      })
    }
    // Yield between files so the UI can paint progress.
    await new Promise((r) => setTimeout(r, 0))
  }

  for (const extra of extraFiles ?? []) {
    await writer.add(extra.path, extra.bytes.length, new Date(), async (push) => {
      push(extra.bytes)
    })
  }

  await writer.finish()

  onProgress?.({
    phase: 'done',
    done: total,
    total,
    bytes,
    failures: failures.length,
    currentName: '',
  })
  return {
    blob: options.output?.mode === 'stream' ? null : new Blob(blobParts!, { type: 'application/zip' }),
    bytes,
    count: writer.entries,
    failures,
  }
}

function mtimeFor(item: { timestampMs: number | null; mtimeMs: number }): Date | undefined {
  const ms = item.timestampMs ?? (item.mtimeMs > 0 ? item.mtimeMs : undefined)
  return ms !== undefined ? new Date(ms) : undefined
}

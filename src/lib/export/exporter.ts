import { OutputZipBuilder } from '@/lib/zip/writer'
import type { ArchiveSession } from '@/lib/snapchat/session'
import type { ExportPlan } from '@/lib/snapchat/plan'

/**
 * The exporter: turns a plan into a brand-new ZIP by streaming each item out
 * of the original archive and storing it byte-identically. The user's source
 * ZIP is never modified. Per-file failures are collected, never fatal —
 * Easy Mode recovers as much as safely possible.
 */

export interface ExportProgress {
  phase: 'packing' | 'done'
  done: number
  total: number
  bytes: number
  failures: number
  currentName: string
}

export interface ExportOutcome {
  blob: Blob
  bytes: number
  failures: { name: string; reason: string }[]
}

export interface ExportRunOptions {
  onProgress?: (p: ExportProgress) => void
  signal?: AbortSignal
  /** Extra small files to include, e.g. the export report. */
  extraFiles?: { path: string; bytes: Uint8Array }[]
}

export async function exportPlan(
  session: ArchiveSession,
  plan: ExportPlan,
  options: ExportRunOptions = {},
): Promise<ExportOutcome> {
  const { onProgress, signal, extraFiles } = options
  const builder = new OutputZipBuilder()
  const failures: { name: string; reason: string }[] = []
  let bytes = 0
  const total = plan.entries.length

  for (let i = 0; i < plan.entries.length; i++) {
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
      await builder.addStream(planned.path, mtimeFor(planned.item), async (push) => {
        await session.extractTo(planned.item, (chunk) => {
          bytes += chunk.length
          push(chunk, false)
        })
        push(new Uint8Array(0), true)
      })
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
    await builder.add(extra.path, extra.bytes)
  }

  onProgress?.({
    phase: 'done',
    done: total,
    total,
    bytes,
    failures: failures.length,
    currentName: '',
  })
  return { blob: builder.finish(), bytes, failures }
}

function mtimeFor(item: { timestampMs: number | null; mtimeMs: number }): Date | undefined {
  const ms = item.timestampMs ?? (item.mtimeMs > 0 ? item.mtimeMs : undefined)
  return ms !== undefined ? new Date(ms) : undefined
}

/** Saves a blob via the File System Access API when available, else an anchor. */
export async function saveBlob(blob: Blob, filename: string): Promise<void> {
  const picker = (window as { showSaveFilePicker?: (opts: unknown) => Promise<FileSystemFileHandle> })
    .showSaveFilePicker
  if (picker) {
    try {
      const handle = await picker({
        suggestedName: filename,
        types: [{ description: 'ZIP archive', accept: { 'application/zip': ['.zip'] } }],
      })
      const writable = await (
        handle as FileSystemFileHandle & { createWritable: () => Promise<WritableStream> }
      ).createWritable()
      await blob.stream().pipeTo(writable)
      return
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      // fall through to anchor download
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Give slow browsers time to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

import { useCallback, useRef, useState } from 'react'
import type { ArchiveSession } from '@/lib/snapchat/session'
import type { ExportPlan } from '@/lib/snapchat/plan'
import {
  exportPlan,
  type ExportProgress,
  type WritebackOptions,
} from '@/lib/export/exporter'
import {
  blobFallbackWarning,
  canStreamToDisk,
  downloadBlob,
  openSaveStream,
} from '@/lib/export/save'

/**
 * Shared Easy/Advanced export orchestration: opens the save dialog during
 * the click gesture, streams the archive to disk when possible, and always
 * surfaces errors to the UI instead of failing silently.
 */

export interface ZipExportState {
  progress: ExportProgress | null
  saved: boolean
  error: string | null
  failureCount: number | null
  warning: string | null
  run: (opts: {
    plan: ExportPlan
    filename: string
    reportBytes?: Uint8Array
    writeback?: WritebackOptions
  }) => Promise<void>
}

export function useZipExport(session: ArchiveSession): ZipExportState {
  const [progress, setProgress] = useState<ExportProgress | null>(null)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [failureCount, setFailureCount] = useState<number | null>(null)
  const [warning] = useState<string | null>(() =>
    blobFallbackWarning(session.sources.reduce((n, s) => n + s.size, 0)),
  )
  const busy = useRef(false)

  const run = useCallback(
    async (opts: {
      plan: ExportPlan
      filename: string
      reportBytes?: Uint8Array
      writeback?: WritebackOptions
    }) => {
      if (busy.current) return
      busy.current = true
      setError(null)
      setSaved(false)
      try {
        // Open the save target FIRST, inside the click's user activation —
        // asking after a long pack would be rejected as a stale gesture.
        let writable: Awaited<ReturnType<typeof openSaveStream>> = null
        if (canStreamToDisk()) {
          try {
            writable = await openSaveStream(opts.filename)
          } catch (err) {
            if (err instanceof DOMException && err.name === 'AbortError') return // user cancelled
            writable = null // fall back to blob download
          }
        }

        const extraFiles = opts.reportBytes
          ? [{ path: 'snapchat-export-report.json', bytes: opts.reportBytes }]
          : []

        const outcome = await exportPlan(session, opts.plan, {
          onProgress: setProgress,
          extraFiles,
          writeback: opts.writeback,
          output: writable
            ? {
                mode: 'stream',
                write: async (chunk) => {
                  await writable!.write(chunk)
                },
              }
            : { mode: 'blob' },
        })

        if (writable) {
          await writable.close()
        } else if (outcome.blob) {
          try {
            downloadBlob(outcome.blob, opts.filename)
          } catch {
            throw new Error(
              'The archive was built but could not be handed to your browser\u2019s downloader. Try Chrome or Edge on desktop, which save directly to disk.',
            )
          }
        }
        setFailureCount(outcome.failures.length)
        setSaved(true)
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Export failed for an unknown reason.'
        setError(
          /memory|allocation|array buffer/i.test(message)
            ? 'This device ran out of memory while packing. A desktop browser (Chrome/Edge) can stream large exports straight to disk.'
            : message,
        )
      } finally {
        busy.current = false
      }
    },
    [session],
  )

  return { progress, saved, error, failureCount, warning, run }
}

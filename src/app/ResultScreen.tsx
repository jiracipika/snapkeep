import { useRef, useState } from 'react'
import type { ArchiveSession } from '@/lib/snapchat/session'
import { buildPlan, DEFAULT_PLAN_OPTIONS } from '@/lib/snapchat/plan'
import { formatHumanDate } from '@/lib/snapchat/datetime'
import { exportPlan, saveBlob, type ExportProgress } from '@/lib/export/exporter'
import { buildExportReport } from '@/lib/export/report'
import { formatCount } from '@/lib/format'
import { LockIcon, PhotoIcon, SparkIcon, VideoIcon } from '@/components/icons'

export function ResultScreen({
  session,
  onAdvanced,
  onRestart,
}: {
  session: ArchiveSession
  onAdvanced: () => void
  onRestart: () => void
}) {
  const { stats, layout, warnings, metadataCount } = session.result
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null)
  const [saved, setSaved] = useState(false)
  const [failureCount, setFailureCount] = useState<number | null>(null)
  const busyRef = useRef(false)

  const isLinkOnly = layout === 'memories-json-only'
  const isEmpty = stats.total === 0 && !isLinkOnly

  const download = async () => {
    if (busyRef.current) return
    busyRef.current = true
    try {
      const plan = buildPlan(session.result.items, DEFAULT_PLAN_OPTIONS)
      const extra = [
        {
          path: 'snapchat-export-report.json',
          bytes: buildExportReport(plan, session, { ...DEFAULT_PLAN_OPTIONS }),
        },
      ]
      const outcome = await exportPlan(session, plan, {
        onProgress: setExportProgress,
        extraFiles: extra,
        writeback: { dates: true, gps: true },
      })
      await saveBlob(outcome.blob, 'Snapchat Memories.zip')
      setFailureCount(outcome.failures.length)
      setSaved(true)
    } finally {
      busyRef.current = false
    }
  }

  if (isEmpty) {
    return (
      <main id="main" className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-6 py-16">
        <div className="card p-8 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-900/40">
            <SparkIcon className="h-7 w-7 text-brand-700 dark:text-brand-300" />
          </span>
          <h1 className="mt-4 text-xl font-bold">No photos or videos found</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-500 dark:text-ink-400">
            This archive doesn’t contain any recognizable media. If you requested
            your data from Snapchat, make sure “Export your Memories” was
            included — some exports only contain account info. The Advanced
            inspector can tell you what’s inside.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <button type="button" className="btn-secondary" onClick={onAdvanced}>
              Inspect archive
            </button>
            <button type="button" className="btn-ghost" onClick={onRestart}>
              Start over
            </button>
          </div>
        </div>
      </main>
    )
  }

  const progressPct =
    exportProgress && exportProgress.total > 0
      ? Math.round((exportProgress.done / exportProgress.total) * 100)
      : 0

  return (
    <main id="main" className="mx-auto w-full max-w-2xl flex-1 px-6 py-12 sm:py-16">
      <div className="card overflow-hidden">
        <div className="bg-gradient-to-b from-brand-50 to-transparent px-8 pb-6 pt-10 text-center dark:from-brand-900/15">
          <h1 className="text-3xl font-bold tracking-tight">Your Memories are ready</h1>
          {isLinkOnly ? (
            <p className="mt-2 text-ink-500 dark:text-ink-400">
              {formatCount(metadataCount)} Memories found as download links
            </p>
          ) : (
            <p className="mt-3 text-5xl font-extrabold tracking-tight text-brand-700 dark:text-brand-300">
              {formatCount(stats.total)}
            </p>
          )}
          {!isLinkOnly && (
            <p className="mt-1 font-medium text-ink-500 dark:text-ink-400">Memories found</p>
          )}
        </div>

        <div className="px-8 pb-8">
          {!isLinkOnly && (
            <div className="mx-auto grid max-w-sm grid-cols-2 gap-3">
              <div className="rounded-2xl bg-ink-50 p-4 text-center dark:bg-ink-800/60">
                <PhotoIcon className="mx-auto h-5 w-5 text-ink-400" />
                <p className="mt-1 text-2xl font-bold">{formatCount(stats.photos)}</p>
                <p className="text-sm text-ink-500 dark:text-ink-400">Photos</p>
              </div>
              <div className="rounded-2xl bg-ink-50 p-4 text-center dark:bg-ink-800/60">
                <VideoIcon className="mx-auto h-5 w-5 text-ink-400" />
                <p className="mt-1 text-2xl font-bold">{formatCount(stats.videos)}</p>
                <p className="text-sm text-ink-500 dark:text-ink-400">Videos</p>
              </div>
            </div>
          )}

          {stats.dateFrom !== null && stats.dateTo !== null && (
            <div className="mx-auto mt-5 flex max-w-sm items-center justify-between rounded-2xl border border-ink-200/70 px-5 py-3 text-sm dark:border-ink-700">
              <div>
                <p className="text-xs uppercase tracking-wide text-ink-400">From</p>
                <p className="font-semibold">{formatHumanDate(stats.dateFrom)}</p>
              </div>
              <div aria-hidden className="h-8 w-px bg-ink-200 dark:bg-ink-700" />
              <div className="text-right">
                <p className="text-xs uppercase tracking-wide text-ink-400">To</p>
                <p className="font-semibold">{formatHumanDate(stats.dateTo)}</p>
              </div>
            </div>
          )}

          {(stats.matched > 0 || stats.archiveDated > 0) && (
            <p className="mt-4 text-center text-xs text-ink-400 dark:text-ink-500">
              {stats.matched > 0 && `${formatCount(stats.matched)} matched with Snapchat dates`}
              {stats.matched > 0 && stats.archiveDated > 0 && ' · '}
              {stats.archiveDated > 0 &&
                `${formatCount(stats.archiveDated)} recovered using archive dates`}
              {stats.undated > 0 &&
                ` · ${formatCount(stats.undated)} kept without dates (none invented)`}
            </p>
          )}

          {isLinkOnly && (
            <p className="mx-auto mt-4 max-w-md rounded-2xl bg-ink-50 p-4 text-center text-xs leading-relaxed text-ink-500 dark:bg-ink-800/60 dark:text-ink-400">
              This export lists your Memories with Snapchat download links instead
              of the files themselves. Snapkeep packages the organized list for
              you; the links usually expire within days, so request a new export
              with “Export your Memories” enabled to get the actual files.
            </p>
          )}

          {warnings.length > 0 && (
            <ul className="mx-auto mt-4 max-w-md space-y-1 text-xs text-ink-400 dark:text-ink-500">
              {warnings.slice(0, 3).map((w) => (
                <li key={w}>• {w}</li>
              ))}
            </ul>
          )}

          <div className="mt-8">
            {exportProgress && exportProgress.phase === 'packing' ? (
              <div aria-live="polite">
                <div
                  className="h-3 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800"
                  role="progressbar"
                  aria-label="Packing your Memories"
                  aria-valuenow={progressPct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="h-full rounded-full bg-brand-500 transition-all"
                    style={{ width: `${Math.max(2, progressPct)}%` }}
                  />
                </div>
                <p className="mt-2 text-center text-sm text-ink-500 dark:text-ink-400">
                  Packing {formatCount(exportProgress.done)} of{' '}
                  {formatCount(exportProgress.total)} — keep this tab open
                </p>
              </div>
            ) : saved ? (
              <div className="text-center" aria-live="polite">
                <p className="text-lg font-bold">Saved!</p>
                <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
                  Check your downloads for <strong>Snapchat Memories.zip</strong>
                  {failureCount !== null && failureCount > 0 && (
                    <> — {formatCount(failureCount)} files couldn’t be packed (see the report inside)</>
                  )}
                </p>
                <button type="button" className="btn-secondary mt-4" onClick={download}>
                  Download again
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="btn-primary mx-auto flex w-full max-w-sm px-6 py-4 text-base"
                onClick={download}
              >
                Download My Memories
              </button>
            )}
          </div>

          <div className="mt-4 flex flex-col items-center gap-2">
            <button type="button" className="btn-ghost text-sm" onClick={onAdvanced}>
              Review in Advanced Mode
            </button>
            <p className="flex items-center gap-1.5 text-xs text-ink-400 dark:text-ink-500">
              <LockIcon className="h-3.5 w-3.5" />
              Your archive never left this device
            </p>
            <p className="max-w-sm text-center text-xs text-ink-400 dark:text-ink-500">
              Capture dates and locations are embedded into your files so Google
              Photos and Apple Photos sort them correctly.
            </p>
          </div>
        </div>
      </div>

      <button type="button" className="btn-ghost mx-auto mt-6 block text-sm" onClick={onRestart}>
        Process another archive
      </button>
    </main>
  )
}

import { useRef, useState } from 'react'
import type { ArchiveSession } from '@/lib/snapchat/session'
import type { ExportPlan, PlanOptions } from '@/lib/snapchat/plan'
import { exportPlan, saveBlob, type ExportProgress } from '@/lib/export/exporter'
import { buildExportReport } from '@/lib/export/report'
import { formatBytes, formatCount } from '@/lib/format'

export function ExportPanel({
  session,
  plan,
  options,
  excludedCount,
}: {
  session: ArchiveSession
  plan: ExportPlan
  options: PlanOptions
  excludedCount: number
}) {
  const [progress, setProgress] = useState<ExportProgress | null>(null)
  const [saved, setSaved] = useState(false)
  const [failureCount, setFailureCount] = useState<number | null>(null)
  const [includeReport, setIncludeReport] = useState(true)
  const busy = useRef(false)

  const run = async () => {
    if (busy.current) return
    busy.current = true
    setSaved(false)
    try {
      const extraFiles = includeReport
        ? [
            {
              path: 'snapchat-export-report.json',
              bytes: buildExportReport(plan, session, options),
            },
          ]
        : []
      const outcome = await exportPlan(session, plan, {
        onProgress: setProgress,
        extraFiles,
      })
      await saveBlob(outcome.blob, `${options.rootName || 'Snapchat Memories'}.zip`)
      setFailureCount(outcome.failures.length)
      setSaved(true)
    } finally {
      busy.current = false
    }
  }

  const totalBytes = plan.entries.reduce((n, e) => n + e.item.size, 0)
  const progressPct =
    progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0

  return (
    <div className="card p-6">
      <h3 className="font-semibold">Export</h3>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <Summary label="Files to export" value={formatCount(plan.entries.length)} />
        <Summary label="Estimated size" value={formatBytes(totalBytes)} />
        <Summary label="Name collisions" value={formatCount(plan.collisions)} />
        <Summary
          label="Skipped"
          value={formatCount(plan.skipped.length + excludedCount)}
        />
      </dl>

      <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="h-4 w-4 accent-brand-600"
          checked={includeReport}
          onChange={(e) => setIncludeReport(e.target.checked)}
        />
        Include snapchat-export-report.json (paths, dates, sources — no GPS or captions)
      </label>

      <div className="mt-5">
        {progress && progress.phase === 'packing' ? (
          <div aria-live="polite">
            <div
              className="h-3 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800"
              role="progressbar"
              aria-valuenow={progressPct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Export progress"
            >
              <div
                className="h-full rounded-full bg-brand-500 transition-all"
                style={{ width: `${Math.max(2, progressPct)}%` }}
              />
            </div>
            <p className="mt-2 text-sm text-ink-500 dark:text-ink-400">
              Packing {formatCount(progress.done)} of {formatCount(progress.total)} —{' '}
              {progress.currentName}
            </p>
          </div>
        ) : saved ? (
          <div aria-live="polite">
            <p className="font-semibold">Export saved.</p>
            {failureCount !== null && failureCount > 0 && (
              <p className="mt-1 text-sm text-amber-600 dark:text-amber-400">
                {formatCount(failureCount)} file(s) could not be packed — details are
                in the report inside the archive.
              </p>
            )}
            <button type="button" className="btn-secondary mt-3" onClick={run}>
              Export again
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="btn-primary w-full max-w-sm py-4 text-base"
            onClick={run}
            disabled={plan.entries.length === 0}
          >
            Export {formatCount(plan.entries.length)} files
          </button>
        )}
      </div>
    </div>
  )
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-ink-50 p-3 dark:bg-ink-800/60">
      <dt className="text-xs text-ink-400">{label}</dt>
      <dd className="mt-0.5 font-bold">{value}</dd>
    </div>
  )
}

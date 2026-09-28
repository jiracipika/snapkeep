import { AlertIcon } from '@/components/icons'

const STAGES = [
  { id: 'opening', label: 'Opening Snapchat archive' },
  { id: 'detecting', label: 'Finding your photos and videos' },
  { id: 'metadata', label: 'Reading dates' },
  { id: 'matching', label: 'Matching photos and videos' },
  { id: 'ready', label: 'Preparing your Memories' },
] as const

export function ProcessingScreen({
  stage,
  fileCount,
  error,
  onCancel,
}: {
  stage: string
  fileCount: number
  error: string | null
  onCancel: () => void
}) {
  const stageIndex = STAGES.findIndex((s) => s.id === stage)
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-6 py-16">
      <div className="card p-8">
        {error ? (
          <div className="text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/40">
              <AlertIcon className="h-7 w-7 text-red-600 dark:text-red-400" />
            </span>
            <h1 className="mt-4 text-xl font-bold">We couldn’t read that archive</h1>
            <p className="mt-2 text-sm leading-relaxed text-ink-500 dark:text-ink-400">{error}</p>
            <button type="button" className="btn-primary mt-6" onClick={onCancel}>
              Try another file
            </button>
          </div>
        ) : (
          <>
            <h1 className="text-center text-xl font-bold">Working on it…</h1>
            <p className="mt-1 text-center text-sm text-ink-500 dark:text-ink-400">
              {fileCount > 1
                ? `${fileCount} archive parts, processed on your device`
                : 'Processed on your device — nothing is uploaded'}
            </p>
            <ol className="mt-8 space-y-4" aria-live="polite">
              {STAGES.map((s, i) => {
                const done = i < stageIndex
                const active = i === stageIndex
                return (
                  <li key={s.id} className="flex items-center gap-3">
                    <span
                      aria-hidden
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors ${
                        done
                          ? 'border-brand-500 bg-brand-500 text-ink-950'
                          : active
                            ? 'border-brand-500 text-brand-700 dark:text-brand-300'
                            : 'border-ink-200 text-ink-300 dark:border-ink-700 dark:text-ink-600'
                      }`}
                    >
                      {done ? '✓' : i + 1}
                    </span>
                    <span
                      className={`text-sm ${
                        done || active
                          ? 'font-medium text-ink-700 dark:text-ink-200'
                          : 'text-ink-400 dark:text-ink-600'
                      }`}
                    >
                      {s.label}
                      {active && <span className="animate-pulse"> …</span>}
                    </span>
                  </li>
                )
              })}
            </ol>
            <div
              className="mt-8 h-2 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800"
              role="progressbar"
              aria-label="Processing progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.max(5, Math.round(((stageIndex + 1) / STAGES.length) * 100))}
            >
              <div
                className="h-full rounded-full bg-brand-500 transition-all duration-500"
                style={{ width: `${Math.max(5, ((stageIndex + 1) / STAGES.length) * 100)}%` }}
              />
            </div>
            <button type="button" className="btn-ghost mx-auto mt-6 block" onClick={onCancel}>
              Cancel
            </button>
          </>
        )}
      </div>
    </main>
  )
}

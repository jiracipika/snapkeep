import { motion } from 'motion/react'
import { AlertIcon, CheckIcon, LockIcon } from '@/components/icons'
import { spring } from '@/components/motionPresets'
import { LiftButton } from '@/components/motionUI'

const STAGES = [
  { id: 'opening', label: 'Opening Snapchat archive' },
  { id: 'detecting', label: 'Finding your photos and videos' },
  { id: 'metadata', label: 'Reading dates' },
  { id: 'matching', label: 'Matching photos and videos' },
  { id: 'ready', label: 'Preparing your Memories' },
] as const

// Stage rows rise in sequence; the active row carries a rotating ring so the
// screen always shows which step is running. MotionConfig reducedMotion="user"
// resolves all transforms instantly for reduced-motion users.
const listVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.15 } },
}
const rowVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: spring },
}

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
  const pct = Math.max(5, Math.round(((stageIndex + 1) / STAGES.length) * 100))
  return (
    <main id="main" className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-6 py-16">
      {/* Progress surface springs in when the scan screen mounts. */}
      <motion.div
        className="card p-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={spring}
      >
        {error ? (
          <div className="text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/40">
              <AlertIcon className="h-7 w-7 text-red-600 dark:text-red-400" />
            </span>
            <h1 className="mt-4 text-xl font-bold">We couldn’t read that archive</h1>
            <p className="mt-2 text-sm leading-relaxed text-ink-500 dark:text-ink-400">{error}</p>
            <LiftButton type="button" className="btn-primary mt-6" onClick={onCancel}>
              Try another file
            </LiftButton>
          </div>
        ) : (
          <>
            <h1 className="text-center text-xl font-bold">Working on it…</h1>
            <p className="mt-1 flex items-center justify-center gap-1.5 text-center text-sm text-ink-500 dark:text-ink-400">
              <LockIcon className="h-3.5 w-3.5 shrink-0 text-brand-700 dark:text-brand-300" />
              {fileCount > 1
                ? `${fileCount} archive parts, processed on your device`
                : 'Processed on your device — nothing is uploaded'}
            </p>
            <motion.ol
              className="mt-8 space-y-4"
              aria-live="polite"
              variants={listVariants}
              initial="hidden"
              animate="show"
            >
              {STAGES.map((s, i) => {
                const done = i < stageIndex
                const active = i === stageIndex
                return (
                  <motion.li key={s.id} variants={rowVariants} className="flex items-center gap-3">
                    <span
                      aria-hidden
                      className={`relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                        done
                          ? 'border-brand-500 bg-brand-500 text-ink-950'
                          : active
                            ? 'border-brand-500 text-brand-700 dark:text-brand-300'
                            : 'border-ink-200 text-ink-400 dark:border-ink-700 dark:text-ink-500'
                      }`}
                    >
                      {done && (
                        <motion.span
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ ...spring, delay: 0.1 }}
                          className="flex"
                        >
                          <CheckIcon className="h-3.5 w-3.5" strokeWidth={3} />
                        </motion.span>
                      )}
                      {active && (
                        <>
                          <span className="absolute inset-[-2px] animate-spin rounded-full border-2 border-transparent border-t-brand-500" />
                          <span className="text-xs font-bold">{i + 1}</span>
                        </>
                      )}
                      {!done && !active && <span className="text-xs font-bold">{i + 1}</span>}
                    </span>
                    <span
                      className={`text-sm ${
                        done || active
                          ? 'font-medium text-ink-700 dark:text-ink-200'
                          : 'text-ink-400 dark:text-ink-500'
                      }`}
                    >
                      {s.label}
                    </span>
                    <span className="ml-auto text-xs tabular-nums text-ink-400 dark:text-ink-500">
                      {done || active ? `${i + 1}/${STAGES.length}` : ''}
                    </span>
                  </motion.li>
                )
              })}
            </motion.ol>
            <div className="mt-8">
              <div
                className="h-2 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800"
                role="progressbar"
                aria-label="Processing progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={pct}
              >
                <motion.div
                  className="h-full rounded-full bg-brand-500"
                  animate={{ width: `${pct}%` }}
                  transition={{ type: 'spring', bounce: 0.15, duration: 0.7 }}
                />
              </div>
              <p className="mt-2 text-right text-xs tabular-nums text-ink-400 dark:text-ink-500">
                Step {Math.max(1, stageIndex + 1)} of {STAGES.length}
              </p>
            </div>
            <LiftButton type="button" className="btn-ghost mx-auto mt-4 block" onClick={onCancel}>
              Cancel
            </LiftButton>
          </>
        )}
      </motion.div>
    </main>
  )
}

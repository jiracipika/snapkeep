import { useCallback, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { UploadIcon } from './icons'

/**
 * The drop zone is the page's authored moment: the upload mark floats gently
 * at idle, warms on hover, and on drag-over the dashed frame "marches" (an
 * animated SVG stroke) while the copy swaps to the release prompt. All
 * transform motion resolves instantly under prefers-reduced-motion
 * (<MotionConfig reducedMotion="user"> in main.tsx + the global CSS guard).
 */
export function DropZone({
  onFiles,
  disabled = false,
}: {
  onFiles: (files: File[]) => void
  disabled?: boolean
}) {
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const accept = useCallback((dt: DataTransfer | null): boolean => {
    if (!dt) return true
    const types = dt.types ? Array.from(dt.types) : []
    // Firefox/Chrome expose dragged files via 'Files' even when names are hidden.
    return types.includes('Files')
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      if (disabled) return
      const files = Array.from(e.dataTransfer.files ?? [])
      if (files.length > 0) onFiles(files)
    },
    [disabled, onFiles],
  )

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label="Drop your Snapchat ZIP export here, or press Enter to choose files"
      aria-disabled={disabled}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => {
        if (disabled) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          inputRef.current?.click()
        }
      }}
      onDragOver={(e) => {
        e.preventDefault()
        if (accept(e.dataTransfer)) setDragOver(true)
      }}
      onDragLeave={(e) => {
        e.preventDefault()
        setDragOver(false)
      }}
      onDrop={handleDrop}
      className={`group relative flex h-64 w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed p-6 text-center transition-colors duration-200 ${
        dragOver
          ? 'border-brand-500 bg-brand-50/90 shadow-card dark:border-brand-500 dark:bg-brand-900/30'
          : 'border-ink-300 bg-ink-50/60 hover:border-brand-400 hover:bg-brand-50/40 dark:border-ink-600 dark:bg-ink-900/40 dark:hover:border-brand-500/70 dark:hover:bg-brand-900/10'
      } ${disabled ? 'pointer-events-none opacity-60' : ''}`}
    >
      {/* Marching dashed frame — visible only while a file is held over the zone. */}
      {!disabled && (
        <svg
          aria-hidden
          className={`pointer-events-none absolute inset-0 h-full w-full overflow-visible transition-opacity duration-300 ${
            dragOver ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <rect
            x="1"
            y="1"
            style={{ width: 'calc(100% - 2px)', height: 'calc(100% - 2px)' }}
            rx={23}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray="10 8"
            className={`text-brand-500 dark:text-brand-400 ${dragOver ? 'animate-dash-march' : ''}`}
          />
        </svg>
      )}

      <motion.span
        aria-hidden
        animate={dragOver ? { scale: 1.12, y: -4 } : { scale: 1, y: [0, -5, 0] }}
        transition={
          dragOver
            ? { type: 'spring', stiffness: 420, damping: 18 }
            : { duration: 3.2, repeat: Infinity, ease: 'easeInOut' }
        }
        className={`flex h-16 w-16 items-center justify-center rounded-full transition-colors duration-200 ${
          dragOver
            ? 'bg-brand-400/60 dark:bg-brand-500/30'
            : 'bg-brand-100 group-hover:bg-brand-200/70 dark:bg-brand-900/40'
        }`}
      >
        <UploadIcon
          className={`h-8 w-8 transition-colors duration-200 ${
            dragOver
              ? 'text-brand-800 dark:text-brand-200'
              : 'text-brand-700 dark:text-brand-300'
          }`}
        />
      </motion.span>

      <span className="text-lg font-semibold" aria-live="polite">
        {dragOver ? 'Release to scan your archive' : 'Drop your Snapchat ZIP here'}
      </span>

      <span className="text-sm text-ink-500 dark:text-ink-400">
        {dragOver ? (
          'It will be read right here — never uploaded'
        ) : (
          <>
            or{' '}
            <span className="font-semibold text-brand-700 underline decoration-brand-300 underline-offset-2 transition-colors group-hover:decoration-brand-500 dark:text-brand-300">
              choose files
            </span>
          </>
        )}
      </span>

      <span className="text-xs text-ink-400 dark:text-ink-500">
        all parts of a multi-file export can be dropped together · stays on this device
      </span>

      <input
        ref={inputRef}
        type="file"
        accept=".zip,application/zip,application/x-zip-compressed"
        multiple
        className="sr-only"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          if (files.length > 0) onFiles(files)
          e.target.value = ''
        }}
      />
    </div>
  )
}

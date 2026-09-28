import { useCallback, useRef, useState } from 'react'
import { UploadIcon } from './icons'

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
      className={`group relative flex h-64 w-full cursor-pointer flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed p-6 text-center transition-all duration-200 ${
        dragOver
          ? 'scale-[1.01] border-brand-500 bg-brand-50/80 dark:border-brand-500 dark:bg-brand-900/25'
          : 'border-ink-300 bg-ink-50/60 hover:border-brand-400 hover:bg-brand-50/40 dark:border-ink-600 dark:bg-ink-900/40 dark:hover:border-brand-500/70 dark:hover:bg-brand-900/10'
      } ${disabled ? 'pointer-events-none opacity-60' : ''}`}
    >
      <span
        className={`flex h-16 w-16 items-center justify-center rounded-full transition-transform duration-200 ${
          dragOver ? 'scale-110' : 'group-hover:scale-105'
        } bg-brand-100 dark:bg-brand-900/40`}
      >
        <UploadIcon className="h-8 w-8 text-brand-700 dark:text-brand-300" />
      </span>
      <span className="text-lg font-semibold">Drop your Snapchat ZIP here</span>
      <span className="text-sm text-ink-500 dark:text-ink-400">
        or{' '}
        <span className="font-semibold text-brand-700 underline decoration-brand-300 underline-offset-2 dark:text-brand-300">
          choose files
        </span>
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

import { useRef, useState, type DragEvent, type MouseEvent } from 'react'
import { UploadIcon } from './icons'

export function DropZone({ onFiles }: { onFiles: (files: File[]) => void }) {
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragOver(false)
    const files = Array.from(event.dataTransfer.files)
    if (files.length > 0) onFiles(files)
  }

  // The whole zone is the target, so a tap anywhere in it opens the picker.
  // The button handles its own click; this one must not open a second time.
  const handleZoneClick = (event: MouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('button')) return
    inputRef.current?.click()
  }

  return (
    <div
      className="import-drop"
      data-drag-over={dragOver}
      onClick={handleZoneClick}
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes('Files')) return
        event.preventDefault()
        event.dataTransfer.dropEffect = 'copy'
        setDragOver(true)
      }}
      onDragLeave={(event) => {
        const target = event.relatedTarget
        if (!(target instanceof Node) || !event.currentTarget.contains(target)) {
          setDragOver(false)
        }
      }}
      onDrop={handleDrop}
    >
      <span className="drop-mark" aria-hidden="true"><UploadIcon /></span>
      {/* Drag and drop is a pointer-device action; on a phone the zone shows
          the button and nothing about dragging (see .drop-title). */}
      <p className="drop-title" aria-live="polite">
        {dragOver ? 'Release to open your ZIP' : 'Drag and drop your ZIP here'}
      </p>
      <button
        type="button"
        className="btn-primary import-pick"
        aria-describedby="import-formats"
        onClick={() => inputRef.current?.click()}
      >
        Choose ZIP files
      </button>
      <p id="import-formats" className="drop-formats">
        Select all ZIPs together for a <span className="whitespace-nowrap">multi-part</span> export.
      </p>
      <input
        ref={inputRef}
        type="file"
        accept=".zip,application/zip,application/x-zip-compressed"
        multiple
        hidden
        onChange={(event) => {
          const files = Array.from(event.currentTarget.files ?? [])
          event.currentTarget.value = ''
          if (files.length > 0) onFiles(files)
        }}
      />
    </div>
  )
}

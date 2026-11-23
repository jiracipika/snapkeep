import { useRef, useState, type DragEvent } from 'react'
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

  return (
    <div
      className="import-drop"
      data-drag-over={dragOver}
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
      <p id="import-formats" className="drop-formats">Select all ZIPs together for a multi-part export.</p>
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

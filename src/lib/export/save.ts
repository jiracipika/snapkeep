/**
 * Saving the exported ZIP.
 *
 * Preferred path: File System Access `showSaveFilePicker`, invoked during
 * the button's user gesture so activation hasn't expired after a long pack.
 * Chunks stream straight to disk — multi-GB exports never sit in memory.
 * Fallback (Safari/Firefox): one Blob + anchor download.
 */

interface MinimalWritable {
  write: (chunk: Uint8Array) => Promise<void>
  close: () => Promise<void>
  abort?: (reason?: unknown) => Promise<void>
}

interface MinimalFileHandle {
  createWritable: () => Promise<MinimalWritable>
}

type SavePicker = (opts: unknown) => Promise<unknown>

export function canStreamToDisk(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof (window as { showSaveFilePicker?: SavePicker }).showSaveFilePicker === 'function'
  )
}

/**
 * Opens a save dialog and returns a writable stream. Must be called from a
 * user-gesture handler. Returns null when the browser lacks support, and
 * rethrows AbortError when the user cancels the dialog.
 */
export async function openSaveStream(suggestedName: string): Promise<MinimalWritable | null> {
  const picker = (window as { showSaveFilePicker?: SavePicker }).showSaveFilePicker
  if (typeof picker !== 'function') return null
  const handle = (await picker({
    suggestedName,
    types: [{ description: 'ZIP archive', accept: { 'application/zip': ['.zip'] } }],
  })) as MinimalFileHandle
  return handle.createWritable()
}

/** Blob fallback: create an object URL and click a temporary anchor. */
export function downloadBlob(blob: Blob, filename: string): void {
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

/** True when the environment cannot stream to disk (blob-only fallback). */
export function blobFallbackWarning(totalSourceBytes: number): string | null {
  if (canStreamToDisk()) return null
  if (totalSourceBytes > 1.5 * 1024 ** 3) {
    return 'This export is large and this browser builds it in memory. Chrome or Edge on desktop can save it directly to disk instead.'
  }
  return null
}

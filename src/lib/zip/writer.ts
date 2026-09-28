import { Zip, ZipPassThrough } from 'fflate'

/**
 * Builds a brand-new ZIP for the user. Media bytes are STORED, never
 * recompressed: what comes out is byte-identical to what was in the archive,
 * and archiving is fast even for huge libraries.
 *
 * The original Snapchat archive is only ever read — never written to.
 */

export class OutputZipBuilder {
  private parts: BlobPart[] = []
  private error: Error | null = null
  private zip = new Zip((err, data) => {
    if (err) {
      this.error ??= err instanceof Error ? err : new Error(String(err))
      return
    }
    if (data) this.parts.push(data.slice())
  })
  private fileCount = 0

  /** Adds a file with already-safe `path` (forward slashes, no `..`). */
  add(path: string, bytes: Uint8Array, mtime?: Date): Promise<void> {
    assertSafeArchivePath(path)
    return this.addStream(path, mtime, async (push) => {
      push(bytes, true)
    })
  }

  /**
   * Adds a file whose bytes arrive in chunks (streamed extraction).
   * `write` must call `push` for every chunk, exactly once with final=true.
   */
  async addStream(
    path: string,
    mtime: Date | undefined,
    write: (push: (chunk: Uint8Array, final: boolean) => void) => Promise<void>,
  ): Promise<void> {
    assertSafeArchivePath(path)
    const file = new ZipPassThrough(path)
    if (mtime && Number.isFinite(mtime.getTime())) {
      // fflate encodes the local-time components of this Date into the DOS
      // fields; shift so the stored fields carry our UTC timestamp exactly.
      file.mtime = new Date(mtime.getTime() + mtime.getTimezoneOffset() * 60_000)
    }
    this.zip.add(file)
    let deferred: { resolve: () => void; reject: (e: Error) => void }
    const done = new Promise<void>((resolve, reject) => {
      deferred = { resolve, reject }
    })
    const push = (chunk: Uint8Array, final: boolean) => {
      try {
        file.push(chunk, final)
      } catch (err) {
        this.error ??= err instanceof Error ? err : new Error(String(err))
      }
    }
    try {
      await write(push)
      deferred!.resolve()
    } catch (err) {
      this.error ??= err instanceof Error ? err : new Error(String(err))
      deferred!.resolve()
    }
    this.fileCount++
    await done
  }

  finish(): Blob {
    if (this.error) throw this.error
    this.zip.end()
    if (this.error) throw this.error
    return new Blob(this.parts, { type: 'application/zip' })
  }

  get count(): number {
    return this.fileCount
  }
}

const RESERVED_WINDOWS_NAMES = new Set([
  'CON', 'PRN', 'AUX', 'NUL',
  ...Array.from({ length: 9 }, (_, i) => `COM${i + 1}`),
  ...Array.from({ length: 9 }, (_, i) => `LPT${i + 1}`),
])

/**
 * Sanitizes one path segment for Windows/macOS/ZIP-extraction safety.
 * Replaces: / \ : * ? " < > | and control chars; blocks reserved device
 * names; strips leading dots and trailing dots/spaces; caps length.
 */
export function sanitizeSegment(input: string, maxLength = 160): string {
  let s = input.normalize('NFC')
  // oxlint-disable-next-line no-control-regex -- stripping control chars is the point
  s = s.replace(/[/\\:*?"<>|\u0000-\u001f\u007f]/g, '_')
  s = s.replace(/\s+/g, ' ').trim()
  s = s.replace(/^[.\s]+/, '')
  s = s.replace(/[.\s]+$/, '')
  if (s.length > maxLength) s = s.slice(0, maxLength).replace(/[.\s]+$/, '')
  const stem = s.replace(/\.[^.]*$/, '')
  if (RESERVED_WINDOWS_NAMES.has(stem.toUpperCase())) s = `_${s}`
  if (!s) s = 'file'
  return s
}

/** Defense-in-depth for paths written into the output archive. */
export function assertSafeArchivePath(path: string): void {
  if (path.includes('\0')) throw new Error(`Refusing to write path with NUL byte: ${path}`)
  const segments = path.split('/')
  if (path.startsWith('/') || segments.some((seg) => seg === '..' || seg === '')) {
    throw new Error(`Refusing to write unsafe archive path: ${path}`)
  }
  if (segments.length > 16) throw new Error(`Archive path too deep: ${path}`)
}

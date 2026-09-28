import { useState } from 'react'
import type { ArchiveSession } from '@/lib/snapchat/session'
import type { MediaItem } from '@/lib/snapchat/types'
import { formatBytes, formatCount } from '@/lib/format'
import { formatDateParts } from '@/lib/snapchat/datetime'

/**
 * Duplicate detection, deliberately conservative: exact size grouping, then
 * SHA-256 byte hashes. Nothing is removed automatically — users mark
 * duplicates to exclude from export and can undo it any time.
 */

interface DuplicateGroup {
  hash: string
  size: number
  items: MediaItem[]
}

export function DuplicatesPanel({
  session,
  excludedIds,
  onExclusionsChange,
}: {
  session: ArchiveSession
  excludedIds: Set<string>
  onExclusionsChange: (ids: Set<string>) => void
}) {
  const [groups, setGroups] = useState<DuplicateGroup[] | null>(null)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const scan = async () => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const candidates = session.result.items.filter((i) => i.size > 0)
      // Group by exact size first — only hash groups with more than one file.
      const bySize = new Map<number, MediaItem[]>()
      for (const item of candidates) {
        const list = bySize.get(item.size) ?? []
        list.push(item)
        bySize.set(item.size, list)
      }
      const sizeGroups = [...bySize.values()].filter((g) => g.length > 1)
      const totalHashes = sizeGroups.reduce((n, g) => n + g.length, 0)
      let done = 0
      setProgress({ done, total: totalHashes })

      const found: DuplicateGroup[] = []
      const concurrency = 4
      let cursor = 0
      const worker = async () => {
        while (cursor < sizeGroups.length) {
          const group = sizeGroups[cursor++]!
          const hashes = new Map<string, MediaItem[]>()
          for (const item of group) {
            const bytes = await session.extractBytes(item)
            const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes))
            const hex = [...new Uint8Array(digest)]
              .map((b) => b.toString(16).padStart(2, '0'))
              .join('')
            const list = hashes.get(hex) ?? []
            list.push(item)
            hashes.set(hex, list)
            done++
            if (done % 25 === 0 || done === totalHashes) setProgress({ done, total: totalHashes })
          }
          for (const [hash, items] of hashes) {
            if (items.length > 1) found.push({ hash, size: group[0]!.size, items })
          }
          await new Promise((r) => setTimeout(r, 0))
        }
      }
      await Promise.all(Array.from({ length: concurrency }, worker))
      found.sort((a, b) => b.items.length - a.items.length)
      setGroups(found)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Duplicate scan failed')
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  const toggle = (id: string) => {
    const next = new Set(excludedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onExclusionsChange(next)
  }

  const excludeAllSuggested = () => {
    const next = new Set(excludedIds)
    for (const g of groups ?? []) for (const item of g.items.slice(1)) next.add(item.id)
    onExclusionsChange(next)
  }

  const reset = () => onExclusionsChange(new Set())

  return (
    <div className="card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">Duplicate finder</h3>
          <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
            Finds byte-identical files (size + SHA-256). Runs entirely on your
            device. Nothing is removed — you choose what to leave out of the
            export.
          </p>
        </div>
        <div className="flex gap-2">
          {groups === null ? (
            <button type="button" className="btn-secondary" onClick={scan} disabled={busy}>
              {busy ? 'Scanning…' : 'Scan for duplicates'}
            </button>
          ) : (
            <>
              <button type="button" className="btn-ghost" onClick={reset}>
                Reset exclusions
              </button>
              <button type="button" className="btn-secondary" onClick={scan} disabled={busy}>
                Rescan
              </button>
            </>
          )}
        </div>
      </div>

      {progress && (
        <div className="mt-4" aria-live="polite">
          <div className="h-2 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800">
            <div
              className="h-full bg-brand-500 transition-all"
              style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 100}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-ink-400">
            Hashing {formatCount(progress.done)} / {formatCount(progress.total)} files
          </p>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {groups !== null && !progress && (
        <>
          <p className="mt-4 text-sm">
            {groups.length === 0 ? (
              <span className="text-ink-500 dark:text-ink-400">
                No duplicates found — every file is unique.
              </span>
            ) : (
              <>
                <strong>{formatCount(groups.length)}</strong> duplicate group
                {groups.length === 1 ? '' : 's'} found
                {excludedIds.size > 0 && (
                  <> · {formatCount(excludedIds.size)} files marked to skip in export</>
                )}
              </>
            )}
          </p>
          {groups.length > 0 && (
            <button type="button" className="btn-ghost mt-2 !px-2 !py-1 text-xs" onClick={excludeAllSuggested}>
              Mark all duplicates beyond the first (keep one of each)
            </button>
          )}
          <ul className="mt-4 max-h-[28rem] space-y-2 overflow-y-auto pr-1">
            {groups.slice(0, 200).map((g) => (
              <li key={g.hash} className="rounded-xl border border-ink-200/70 p-3 dark:border-ink-700/70">
                <p className="text-xs text-ink-400">
                  {formatCount(g.items.length)} identical files · {formatBytes(g.size)} each
                </p>
                <ul className="mt-2 space-y-1">
                  {g.items.map((item, idx) => (
                    <li key={item.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-brand-600"
                        checked={excludedIds.has(item.id)}
                        onChange={() => toggle(item.id)}
                        aria-label={`Exclude ${item.originalFilename} from export`}
                      />
                      <span className="min-w-0 flex-1 truncate" title={item.originalFilename}>
                        {idx === 0 && <span className="mr-1 text-[10px] font-bold text-brand-700">KEEP?</span>}
                        {item.originalFilename}
                      </span>
                      <span className="text-xs text-ink-400">
                        {item.timestampMs !== null ? formatDateParts(item.timestampMs).date : 'undated'}
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

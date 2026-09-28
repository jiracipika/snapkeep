import { useEffect, useMemo, useState } from 'react'
import type { ArchiveSession } from '@/lib/snapchat/session'
import type { MediaItem } from '@/lib/snapchat/types'
import { buildPlan, DEFAULT_PLAN_OPTIONS, type PlanOptions } from '@/lib/snapchat/plan'
import { formatBytes, formatCount } from '@/lib/format'
import { ArchiveInfo } from './ArchiveInfo'
import { MediaGrid } from './MediaGrid'
import { Inspector } from './Inspector'
import { NamingFoldersPanel } from './NamingFoldersPanel'
import { DuplicatesPanel } from './DuplicatesPanel'
import { ExportPanel } from './ExportPanel'
import { ThumbnailService } from './thumbs'

type Tab = 'browse' | 'naming' | 'duplicates' | 'info' | 'export'
type Filter = 'all' | 'photos' | 'videos' | 'overlays' | 'unmatched' | 'undated'
type Sort = 'date-desc' | 'date-asc' | 'name' | 'size'

const TABS: { id: Tab; label: string }[] = [
  { id: 'browse', label: 'Browse' },
  { id: 'naming', label: 'Naming & Folders' },
  { id: 'duplicates', label: 'Duplicates' },
  { id: 'info', label: 'Archive Info' },
  { id: 'export', label: 'Export' },
]

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All Memories' },
  { id: 'photos', label: 'Photos' },
  { id: 'videos', label: 'Videos' },
  { id: 'unmatched', label: 'Unmatched' },
  { id: 'undated', label: 'Undated' },
  { id: 'overlays', label: 'Overlays' },
]

export function AdvancedScreen({
  session,
  onBack,
  onRestart,
}: {
  session: ArchiveSession
  onBack: () => void
  onRestart: () => void
}) {
  const [tab, setTab] = useState<Tab>('browse')
  const [options, setOptions] = useState<PlanOptions>(DEFAULT_PLAN_OPTIONS)
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<Sort>('date-desc')
  const [selection, setSelection] = useState<Set<string>>(new Set())
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set())
  const [openItem, setOpenItem] = useState<MediaItem | null>(null)

  const thumbs = useMemo(() => new ThumbnailService(session), [session])
  useEffect(() => () => thumbs.dispose(), [thumbs])

  const { items } = session.result
  const sourceBytes = session.sources.reduce((n, s) => n + s.size, 0)
  const bigOnMobile = sourceBytes > 2 * 1024 ** 3 && window.innerWidth < 768

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = items
    switch (filter) {
      case 'photos':
        list = list.filter((i) => i.kind === 'photo' && i.role !== 'overlay')
        break
      case 'videos':
        list = list.filter((i) => i.kind === 'video' && i.role !== 'overlay')
        break
      case 'overlays':
        list = list.filter((i) => i.role === 'overlay')
        break
      case 'unmatched':
        list = list.filter((i) => i.role !== 'overlay' && i.timestampSource !== 'metadata')
        break
      case 'undated':
        list = list.filter((i) => i.timestampMs === null)
        break
      case 'all':
        list = list.filter((i) => i.role !== 'overlay')
        break
    }
    if (q) list = list.filter((i) => i.originalFilename.toLowerCase().includes(q))
    const sorted = [...list]
    switch (sort) {
      case 'date-desc':
        sorted.sort((a, b) => (b.timestampMs ?? b.mtimeMs) - (a.timestampMs ?? a.mtimeMs))
        break
      case 'date-asc':
        sorted.sort((a, b) => (a.timestampMs ?? a.mtimeMs) - (b.timestampMs ?? b.mtimeMs))
        break
      case 'name':
        sorted.sort((a, b) => a.originalFilename.localeCompare(b.originalFilename))
        break
      case 'size':
        sorted.sort((a, b) => b.size - a.size)
        break
    }
    return sorted
  }, [items, filter, query, sort])

  const plan = useMemo(() => {
    const scope = (
      selection.size > 0 ? items.filter((i) => selection.has(i.id)) : filtered
    ).filter((i) => !excludedIds.has(i.id))
    return buildPlan(scope, options)
  }, [items, filtered, selection, excludedIds, options])

  const proposedPathOf = (item: MediaItem) =>
    plan.entries.find((e) => e.item.id === item.id)?.path ?? null

  const toggleSelect = (id: string) => {
    const next = new Set(selection)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelection(next)
  }

  const selectAllFiltered = () => setSelection(new Set(filtered.map((i) => i.id)))
  const clearSelection = () => setSelection(new Set())

  return (
    <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Advanced Mode</h1>
          <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
            {formatCount(session.result.stats.total)} memories ·{' '}
            {formatBytes(session.sources.reduce((n, s) => n + s.size, 0))} across{' '}
            {session.sources.length} file{session.sources.length === 1 ? '' : 's'} ·
            processed locally
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn-secondary" onClick={onBack}>
            Easy view
          </button>
          <button type="button" className="btn-ghost" onClick={onRestart}>
            New archive
          </button>
        </div>
      </div>

      {bigOnMobile && (
        <p className="mb-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-700/50 dark:bg-amber-900/20 dark:text-amber-200">
          This archive is {formatBytes(sourceBytes)} — exporting on a phone may
          exhaust browser memory. A desktop browser is recommended for large
          libraries.
        </p>
      )}

      <nav className="mb-6 flex gap-1 overflow-x-auto rounded-2xl bg-ink-100/70 p-1 dark:bg-ink-900" aria-label="Advanced sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id}
            className={`shrink-0 cursor-pointer rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.id
                ? 'bg-white shadow-card dark:bg-ink-800'
                : 'text-ink-500 hover:text-ink-700 dark:hover:text-ink-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'browse' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_20rem]">
          <div className="min-h-[32rem]">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  aria-pressed={filter === f.id}
                  className={`cursor-pointer rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                    filter === f.id
                      ? 'bg-brand-500 text-ink-950'
                      : 'bg-ink-100 text-ink-600 hover:bg-ink-200 dark:bg-ink-800 dark:text-ink-300 dark:hover:bg-ink-700'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search filenames…"
                className="min-w-0 flex-1 rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm dark:border-ink-700 dark:bg-ink-800"
                aria-label="Search filenames"
              />
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as Sort)}
                className="rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm dark:border-ink-700 dark:bg-ink-800"
                aria-label="Sort order"
              >
                <option value="date-desc">Newest first</option>
                <option value="date-asc">Oldest first</option>
                <option value="name">Name A–Z</option>
                <option value="size">Largest first</option>
              </select>
            </div>
            <div className="mb-3 flex items-center justify-between text-xs text-ink-400">
              <span>
                {formatCount(filtered.length)} shown
                {selection.size > 0 && (
                  <>
                    {' '}
                    · {formatCount(selection.size)} selected{' '}
                    <button type="button" className="underline" onClick={clearSelection}>
                      clear
                    </button>
                  </>
                )}
              </span>
              <button type="button" className="underline" onClick={selectAllFiltered}>
                Select all shown
              </button>
            </div>
            <div className="h-[calc(100vh-22rem)] min-h-[28rem]">
              <MediaGrid
                items={filtered}
                thumbs={thumbs}
                selectedId={openItem?.id ?? null}
                selection={selection}
                onOpen={setOpenItem}
                onToggleSelect={toggleSelect}
              />
            </div>
          </div>
          <div className="lg:sticky lg:top-24 lg:h-[calc(100vh-8rem)]">
            {openItem ? (
              <Inspector
                item={openItem}
                proposedPath={proposedPathOf(openItem)}
                onClose={() => setOpenItem(null)}
              />
            ) : (
              <div className="rounded-2xl border border-dashed border-ink-300 p-6 text-sm text-ink-400 dark:border-ink-700">
                Click any item to inspect its metadata, original ZIP path, date
                source and proposed filename.
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'naming' && (
        <div className="max-w-3xl">
          <NamingFoldersPanel
            options={options}
            onChange={setOptions}
            previewItems={filtered}
            plannedPaths={plan.entries.map((e) => e.path)}
          />
        </div>
      )}

      {tab === 'duplicates' && (
        <div className="max-w-3xl">
          <DuplicatesPanel
            session={session}
            excludedIds={excludedIds}
            onExclusionsChange={setExcludedIds}
          />
        </div>
      )}

      {tab === 'info' && <ArchiveInfo session={session} />}

      {tab === 'export' && (
        <div className="max-w-3xl">
          <ExportPanel
            session={session}
            plan={plan}
            options={options}
            excludedCount={excludedIds.size}
          />
          {selection.size > 0 && (
            <p className="mt-3 text-xs text-ink-400">
              Exporting your {formatCount(selection.size)} selected files. Clear
              the selection in Browse to export the current filter instead.
            </p>
          )}
        </div>
      )}
    </main>
  )
}

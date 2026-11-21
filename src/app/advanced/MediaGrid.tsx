import { useEffect, useRef, useState } from 'react'
import type { MediaItem } from '@/lib/snapchat/types'
import type { ThumbnailService } from './thumbs'
import { formatBytes } from '@/lib/format'
import { formatDateParts } from '@/lib/snapchat/datetime'
import { CheckIcon, PhotoIcon, VideoIcon } from '@/components/icons'

/**
 * Virtualized media grid: renders only visible rows (± overscan), so 20k+
 * items scroll smoothly. Thumbnails load lazily from the ThumbnailService.
 */

const CELL = 168
const GAP = 12
const OVERSCAN_ROWS = 3

export function MediaGrid({
  items,
  thumbs,
  selectedId,
  selection,
  onOpen,
  onToggleSelect,
}: {
  items: MediaItem[]
  thumbs: ThumbnailService
  selectedId: string | null
  selection: Set<string>
  onOpen: (item: MediaItem) => void
  onToggleSelect: (id: string) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scroll, setScroll] = useState(0)
  const [height, setHeight] = useState(600)
  const [width, setWidth] = useState(800)
  const [, force] = useState(0)

  useEffect(() => thumbs.subscribe(() => force((n) => n + 1)), [thumbs])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      setHeight(el.clientHeight)
      setWidth(el.clientWidth)
    })
    ro.observe(el)
    setHeight(el.clientHeight)
    setWidth(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  const cols = Math.max(1, Math.floor((width + GAP) / (CELL + GAP)))
  // Phones give the single column the full container width (up to a cap) so
  // the browse grid doesn't leave most of the screen empty.
  const cell = cols === 1 ? Math.min(width - 8, 220) : CELL
  const rows = Math.ceil(items.length / cols)
  const firstRow = Math.max(0, Math.floor(scroll / (cell + GAP)) - OVERSCAN_ROWS)
  const lastRow = Math.min(rows, Math.ceil((scroll + height) / (cell + GAP)) + OVERSCAN_ROWS)

  const visible: { item: MediaItem; row: number; col: number }[] = []
  for (let r = firstRow; r < lastRow; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c
      const item = items[idx]
      if (item) visible.push({ item, row: r, col: c })
    }
  }

  return (
    <div
      ref={containerRef}
      className="relative h-full overflow-y-auto rounded-2xl border border-ink-200/70 dark:border-ink-800"
      onScroll={(e) => setScroll((e.target as HTMLDivElement).scrollTop)}
      role="list"
      aria-label={`Media browser, ${items.length} items`}
    >
      {items.length === 0 ? (
        <p className="p-10 text-center text-sm text-ink-400">
          Nothing matches this view.
        </p>
      ) : (
        <div style={{ height: rows * (cell + GAP) }} className="relative">
          {visible.map(({ item, row, col }) => (
            <GridCell
              key={item.id}
              item={item}
              thumbs={thumbs}
              style={{
                position: 'absolute',
                top: row * (cell + GAP),
                left: col * (cell + GAP),
                width: cell,
                height: cell,
              }}
              selected={selectedId === item.id}
              checked={selection.has(item.id)}
              onOpen={() => onOpen(item)}
              onToggleSelect={() => onToggleSelect(item.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function GridCell({
  item,
  thumbs,
  style,
  selected,
  checked,
  onOpen,
  onToggleSelect,
}: {
  item: MediaItem
  thumbs: ThumbnailService
  style: React.CSSProperties
  selected: boolean
  checked: boolean
  onOpen: () => void
  onToggleSelect: () => void
}) {
  const [tick, setTick] = useState(0)
  useEffect(() => thumbs.subscribe(() => setTick((n) => n + 1)), [thumbs])
  void tick
  const url = thumbs.get(item)
  const date = item.timestampMs !== null ? formatDateParts(item.timestampMs).date : 'undated'
  return (
    <div style={style} role="listitem">
      <button
        type="button"
        onClick={onOpen}
        className={`group relative flex h-full w-full cursor-pointer flex-col overflow-hidden rounded-xl border-2 bg-ink-50 text-left transition-all duration-150 dark:bg-ink-800/60 ${
          selected
            ? 'border-brand-500 shadow-card'
            : 'border-transparent hover:border-ink-300 hover:shadow-card dark:hover:border-ink-600'
        }`}
        aria-label={`${item.originalFilename}, ${item.kind ?? 'media'}, ${date}, ${formatBytes(item.size)}`}
      >
        <span className="relative flex flex-1 items-center justify-center overflow-hidden">
          {url ? (
            <img
              src={url}
              alt=""
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.04]"
            />
          ) : item.kind === 'video' ? (
            <VideoIcon className="h-10 w-10 text-ink-300 transition-transform duration-300 ease-out group-hover:scale-110 dark:text-ink-600" />
          ) : (
            <PhotoIcon className="h-10 w-10 text-ink-300 transition-transform duration-300 ease-out group-hover:scale-110 dark:text-ink-600" />
          )}
          <span
            role="checkbox"
            aria-checked={checked}
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation()
              onToggleSelect()
            }}
            onKeyDown={(e) => {
              if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault()
                e.stopPropagation()
                onToggleSelect()
              }
            }}
            className={`absolute left-1.5 top-1.5 flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border-2 transition-all ${
              checked
                ? 'border-brand-600 bg-brand-500 text-ink-950 opacity-100'
                : 'border-white/80 bg-black/30 text-transparent opacity-90 hover:border-white hover:opacity-100'
            }`}
            aria-label={`Select ${item.originalFilename}`}
          >
            <CheckIcon className="h-3.5 w-3.5" strokeWidth={3} />
          </span>
          {item.kind === 'video' && (
            <span className="absolute bottom-1.5 left-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-white">
              VIDEO
            </span>
          )}
          {item.role === 'overlay' && (
            <span className="absolute bottom-1.5 right-1.5 rounded bg-purple-600/80 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-white">
              OVERLAY
            </span>
          )}
        </span>
        <span className="border-t border-ink-200/60 px-2 py-1.5 dark:border-ink-700/60">
          <span className="block truncate text-[11px] font-medium" title={item.originalFilename}>
            {item.originalFilename}
          </span>
          <span className="block text-[10px] text-ink-500 dark:text-ink-400">{date}</span>
        </span>
      </button>
    </div>
  )
}

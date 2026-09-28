import type { MediaItem } from '@/lib/snapchat/types'
import { formatBytes } from '@/lib/format'
import { formatDateParts } from '@/lib/snapchat/datetime'

const SOURCE_LABEL: Record<string, string> = {
  metadata: 'Snapchat metadata',
  filename: 'Filename date',
  archive: 'Archive timestamp (approximate)',
  none: 'No date available',
}

const CONFIDENCE_LABEL: Record<string, string> = {
  high: 'High — matched via Media ID',
  medium: 'Medium — from filename',
  low: 'Low — approximate',
}

export function Inspector({
  item,
  proposedPath,
  onClose,
}: {
  item: MediaItem
  proposedPath: string | null
  onClose: () => void
}) {
  const date = item.timestampMs !== null ? formatDateParts(item.timestampMs) : null
  return (
    <aside
      className="flex h-full w-full flex-col overflow-y-auto rounded-2xl border border-ink-200/70 bg-white p-5 dark:border-ink-800 dark:bg-ink-900"
      aria-label="Item inspector"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <h3 className="break-all font-semibold">{item.originalFilename}</h3>
        <button type="button" className="btn-ghost !p-1.5 !rounded-lg" onClick={onClose} aria-label="Close inspector">
          ✕
        </button>
      </div>

      <dl className="space-y-3 text-sm">
        <Row label="Proposed name">
          <code className="break-all rounded bg-ink-100 px-1.5 py-0.5 text-xs dark:bg-ink-800">
            {proposedPath ?? '—'}
          </code>
        </Row>
        <Row label="Media type">{item.kind ?? 'Unknown'}</Row>
        {item.role === 'overlay' && (
          <Row label="Role">Overlay layer (pairs with its main file)</Row>
        )}
        {date ? (
          <Row label="Date & time (UTC)">
            {date.date} {date.hour}:{date.minute}:{date.second}
          </Row>
        ) : (
          <Row label="Date & time">Not available</Row>
        )}
        <Row label="Date source">{SOURCE_LABEL[item.timestampSource]}</Row>
        <Row label="Match confidence">{CONFIDENCE_LABEL[item.confidence]}</Row>
        {item.splitGroup && (
          <Row label="Split video">
            Segment {(item.splitIndex ?? 0) + 1} of {item.splitTotal ?? '?'} — segments stay
            in filename order
          </Row>
        )}
        {item.pairedEntryName && (
          <Row label="Paired with">
            <code className="break-all text-xs">{item.pairedEntryName}</code>
          </Row>
        )}
        <Row label="Original ZIP path">
          <code className="break-all text-xs">{item.entryName}</code>
        </Row>
        <Row label="Size">{formatBytes(item.size)}</Row>
        {item.matchedMediaId && (
          <Row label="Media ID">
            <code className="break-all text-xs">{item.matchedMediaId.toLowerCase()}</code>
          </Row>
        )}
        <Row label="Location">
          {item.lat !== null && item.lon !== null
            ? `${item.lat.toFixed(5)}, ${item.lon.toFixed(5)}`
            : 'Not present in export'}
        </Row>
        <Row label="Download URL">
          {item.downloadUrl ? (
            <span className="text-xs text-ink-400">
              present in export (expires; not shown for privacy)
            </span>
          ) : (
            'None'
          )}
        </Row>
      </dl>
    </aside>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-ink-400">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  )
}

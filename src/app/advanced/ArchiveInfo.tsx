import type { ArchiveSession } from '@/lib/snapchat/session'
import { layoutLabel } from '@/lib/snapchat/detector'
import { formatBytes, formatCount } from '@/lib/format'

/** The Phase-4 diagnostic inspector: structure without private content. */
export function ArchiveInfo({ session }: { session: ArchiveSession }) {
  const d = session.result.diagnostics
  return (
    <div className="card divide-y divide-ink-100 dark:divide-ink-800">
      <Section title="Detected layout">
        <p className="text-sm font-medium">{layoutLabel(session.result.layout)}</p>
        <p className="mt-1 text-xs text-ink-400">
          {d.memoriesHistoryName
            ? `Metadata: ${d.memoriesHistoryName}`
            : 'No memories_history.json found'}
        </p>
      </Section>

      <Section title="Contents">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
          <Stat label="Entries" value={formatCount(d.totalEntries)} />
          <Stat label="Media files" value={formatCount(d.mediaCount)} />
          <Stat label="Photos" value={formatCount(d.photoCount)} />
          <Stat label="Videos" value={formatCount(d.videoCount)} />
          <Stat label="Overlays" value={formatCount(d.overlayCount)} />
          <Stat label="Split groups" value={formatCount(d.splitGroupCount)} />
          <Stat label="Unmatched" value={formatCount(d.unmatchedCount)} />
          <Stat label="Packaging junk" value={formatCount(d.junkEntries)} />
          <Stat label="HTML files" value={formatCount(d.htmlCount)} />
        </dl>
      </Section>

      <Section title="JSON metadata files">
        {d.jsonFiles.length === 0 ? (
          <p className="text-sm text-ink-400">None found</p>
        ) : (
          <ul className="space-y-2">
            {d.jsonFiles.map((f) => (
              <li key={`${f.sourceFile}:${f.name}`} className="text-sm">
                <p className="font-mono text-xs">
                  {f.name}{' '}
                  <span className="text-ink-400">
                    ({formatBytes(f.size)}
                    {f.recordCount !== null ? `, ${formatCount(f.recordCount)} records` : ''})
                  </span>
                </p>
                {f.schemaKeys.length > 0 && (
                  <p className="mt-0.5 text-xs text-ink-400">
                    schema keys: {f.schemaKeys.slice(0, 10).join(', ')}
                    {f.schemaKeys.length > 10 && '…'}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="File types">
        <div className="flex flex-wrap gap-2">
          {d.extensionCounts.map(([ext, count]) => (
            <span
              key={ext}
              className="rounded-full bg-ink-100 px-2.5 py-1 text-xs font-medium dark:bg-ink-800"
            >
              .{ext} × {formatCount(count)}
            </span>
          ))}
        </div>
      </Section>

      <Section title="Top-level folders">
        <div className="flex flex-wrap gap-2">
          {d.folders.map(([folder, count]) => (
            <span
              key={folder}
              className="rounded-full bg-ink-100 px-2.5 py-1 font-mono text-xs dark:bg-ink-800"
            >
              {folder}/ × {formatCount(count)}
            </span>
          ))}
        </div>
      </Section>

      <Section title="Source archives">
        <ul className="space-y-1 text-sm">
          {session.sources.map((s, i) => (
            <li key={i} className="font-mono text-xs">
              {s.name} <span className="text-ink-400">({formatBytes(s.size)})</span>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="p-6">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-400">
        {title}
      </h3>
      {children}
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-ink-400">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  )
}

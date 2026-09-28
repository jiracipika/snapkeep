import type { PlanOptions } from '@/lib/snapchat/plan'
import type { MediaItem } from '@/lib/snapchat/types'
import {
  FOLDER_STRATEGIES,
  folderTreePreview,
  type FolderStrategy,
} from '@/lib/snapchat/folders'
import { DEFAULT_TEMPLATE, TEMPLATE_TOKENS, generateFilename } from '@/lib/snapchat/rename'

export function NamingFoldersPanel({
  options,
  onChange,
  previewItems,
  plannedPaths,
}: {
  options: PlanOptions
  onChange: (options: PlanOptions) => void
  previewItems: MediaItem[]
  plannedPaths: string[]
}) {
  const set = (patch: Partial<PlanOptions>) => onChange({ ...options, ...patch })
  return (
    <div className="space-y-5">
      <section className="card p-6">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-ink-400">
          Filename template
        </h3>
        <input
          type="text"
          value={options.filenameTemplate}
          onChange={(e) => set({ filenameTemplate: e.target.value })}
          className="mt-3 w-full rounded-xl border border-ink-200 bg-white px-3 py-2 font-mono text-sm dark:border-ink-700 dark:bg-ink-800"
          aria-label="Filename template"
        />
        <div className="mt-3 flex flex-wrap gap-1.5">
          {TEMPLATE_TOKENS.map((token) => (
            <button
              key={token}
              type="button"
              onClick={() =>
                set({ filenameTemplate: `${options.filenameTemplate}${token}` })
              }
              className="cursor-pointer rounded-full bg-ink-100 px-2.5 py-1 font-mono text-xs hover:bg-brand-100 dark:bg-ink-800 dark:hover:bg-brand-900/40"
            >
              {token}
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-ink-400">
          Example output:
          {previewItems.slice(0, 3).map((item, i) => (
            <code key={item.id} className="ml-2 rounded bg-ink-100 px-1.5 py-0.5 dark:bg-ink-800">
              {generateFilename(item, options.filenameTemplate, i + 1)}
            </code>
          ))}
        </p>
        <button
          type="button"
          className="btn-ghost mt-2 !px-2 !py-1 text-xs"
          onClick={() => set({ filenameTemplate: DEFAULT_TEMPLATE })}
        >
          Reset to default
        </button>
      </section>

      <section className="card p-6">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-ink-400">
          Folder structure
        </h3>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {FOLDER_STRATEGIES.map((s) => (
            <label
              key={s.id}
              className={`flex cursor-pointer items-start gap-2.5 rounded-xl border-2 p-3 text-sm transition-colors ${
                options.folderStrategy === s.id
                  ? 'border-brand-500 bg-brand-50/60 dark:bg-brand-900/20'
                  : 'border-ink-200 hover:border-ink-300 dark:border-ink-700'
              }`}
            >
              <input
                type="radio"
                name="folderStrategy"
                className="mt-1 accent-brand-600"
                checked={options.folderStrategy === s.id}
                onChange={() => set({ folderStrategy: s.id as FolderStrategy })}
              />
              <span>
                <span className="block font-medium">{s.label}</span>
                <span className="block text-xs text-ink-400">{s.hint}</span>
              </span>
            </label>
          ))}
        </div>
        <label className="mt-4 block text-sm">
          <span className="mb-1 block text-xs uppercase tracking-wide text-ink-400">
            Root folder name
          </span>
          <input
            type="text"
            value={options.rootName}
            onChange={(e) => set({ rootName: e.target.value })}
            className="w-full rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm dark:border-ink-700 dark:bg-ink-800"
          />
        </label>
      </section>

      <section className="card p-6">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-ink-400">
          Includes
        </h3>
        <div className="mt-3 space-y-2 text-sm">
          <Toggle
            label="Include overlay layers"
            hint="Separate caption/sticker/filter files, exported alongside their base media"
            checked={options.includeOverlays}
            onChange={(v) => set({ includeOverlays: v })}
          />
          <Toggle
            label="Include all split-video segments"
            hint="When off, only the first segment of each split video is exported"
            checked={options.includeSplitSegments}
            onChange={(v) => set({ includeSplitSegments: v })}
          />
        </div>
      </section>

      <section className="card p-6">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-ink-400">
          Folder preview
        </h3>
        <pre className="mt-3 overflow-x-auto rounded-xl bg-ink-50 p-4 font-mono text-xs leading-relaxed dark:bg-ink-800/60">
{options.rootName}/
{folderTreePreview(plannedPaths).map((line) => `  ${line}`).join('\n')}
        </pre>
      </section>
    </div>
  )
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl p-2 hover:bg-ink-50 dark:hover:bg-ink-800/50">
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 accent-brand-600"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        <span className="block font-medium">{label}</span>
        <span className="block text-xs text-ink-400">{hint}</span>
      </span>
    </label>
  )
}

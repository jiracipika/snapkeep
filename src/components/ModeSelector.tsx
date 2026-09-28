export type Mode = 'easy' | 'advanced'

const MODES: { id: Mode; title: string; blurb: string }[] = [
  {
    id: 'easy',
    title: 'Easy',
    blurb: 'Just get my photos and videos.',
  },
  {
    id: 'advanced',
    title: 'Advanced',
    blurb: 'Customize names, folders, metadata, and more.',
  },
]

export function ModeSelector({
  mode,
  onChange,
}: {
  mode: Mode
  onChange: (mode: Mode) => void
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Choose your mode"
      className="grid w-full max-w-xl grid-cols-1 gap-3 sm:grid-cols-2"
    >
      {MODES.map((m) => {
        const selected = mode === m.id
        return (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(m.id)}
            className={`flex cursor-pointer items-start gap-3 rounded-2xl border-2 p-4 text-left transition-all duration-150 ${
              selected
                ? 'border-brand-500 bg-brand-50/60 shadow-card dark:border-brand-500 dark:bg-brand-900/20'
                : 'border-ink-200 bg-white hover:border-ink-300 dark:border-ink-700 dark:bg-ink-900 dark:hover:border-ink-500'
            }`}
          >
            <span
              aria-hidden
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                selected ? 'border-brand-600' : 'border-ink-300 dark:border-ink-500'
              }`}
            >
              {selected && <span className="h-2.5 w-2.5 rounded-full bg-brand-500" />}
            </span>
            <span>
              <span className="block font-semibold">{m.title}</span>
              <span className="mt-0.5 block text-sm text-ink-500 dark:text-ink-400">
                {m.blurb}
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

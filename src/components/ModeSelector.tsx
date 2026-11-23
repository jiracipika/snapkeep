export type Mode = 'easy' | 'advanced'

const labels: Record<Mode, string> = {
  easy: 'Easy',
  advanced: 'Advanced',
}

const descriptions: Record<Mode, string> = {
  easy: 'Export photos and videos with the default settings.',
  advanced: 'Review media and customize filenames, folders, and metadata.',
}

export function ModeSelector({
  mode,
  onChange,
}: {
  mode: Mode
  onChange: (mode: Mode) => void
}) {
  return (
    <fieldset className="mode-selector" aria-describedby="mode-description">
      <legend>Export mode</legend>
      <div className="mode-options">
        {(['easy', 'advanced'] as const).map((value) => (
          <label key={value}>
            <input
              className="sr-only"
              type="radio"
              name="export-mode"
              value={value}
              checked={mode === value}
              onChange={() => onChange(value)}
            />
            <span>{labels[value]}</span>
          </label>
        ))}
      </div>
      <p id="mode-description">{descriptions[mode]}</p>
    </fieldset>
  )
}

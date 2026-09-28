/**
 * Date/time helpers. Snapchat memories_history.json dates look like
 * "2020-12-21 12:18:40 UTC" — always UTC. Filenames may carry dates in
 * several shapes. All functions return epoch milliseconds.
 */

const SNAP_DATE_RE =
  /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?\s*(?:UTC|GMT)?\s*$/i

/** Parses "YYYY-MM-DD HH:MM:SS UTC" (and tolerant variants) as UTC. */
export function parseSnapchatDate(value: unknown): number | null {
  if (typeof value !== 'string') return null
  const m = SNAP_DATE_RE.exec(value.trim())
  if (!m) {
    const fallback = Date.parse(value)
    return Number.isFinite(fallback) ? fallback : null
  }
  const [, y, mo, d, h, mi, s] = m
  const ms = Date.UTC(+y!, +mo! - 1, +d!, +h!, +mi!, +s!)
  if (!Number.isFinite(ms)) return null
  // Reject nonsense years outright (typo years like 0021 or 3021).
  const year = +y!
  if (year < 2000 || year > 2100) return null
  return ms
}

export interface FilenameDate {
  ms: number
  hasTime: boolean
}

const FILENAME_PATTERNS: { re: RegExp; hasTime: boolean }[] = [
  // 2023-08-14_19-32-05 / 2023-08-14 19.32.05 / 2023-08-14T19-32-05
  { re: /^(\d{4})-(\d{2})-(\d{2})[ _-](\d{2})[.-](\d{2})[.-](\d{2})/, hasTime: true },
  // 20230814_193205 / 20230814-193205 / 20230814193205
  { re: /^(\d{4})(\d{2})(\d{2})[ _-]?(\d{2})(\d{2})(\d{2})/, hasTime: true },
  // 2023-08-14 (date only)
  { re: /^(\d{4})-(\d{2})-(\d{2})(?:[ _T-]|$)/, hasTime: false },
  // 20230814 (date only)
  { re: /^(\d{4})(\d{2})(\d{2})(?:[ _-]|$)/, hasTime: false },
]

/**
 * Extracts a capture-looking date from the start of a filename stem.
 * Snapchat's in-app export names files by their capture date, so these are
 * usable when no metadata exists. Returns null when the stem does not start
 * with a plausible date.
 */
export function parseFilenameDate(stem: string): FilenameDate | null {
  for (const { re, hasTime } of FILENAME_PATTERNS) {
    const m = re.exec(stem)
    if (!m) continue
    const [, y, mo, d, h = '0', mi = '0', s = '0'] = m
    const year = +y!
    if (year < 2011 || year > 2100) continue // Snapchat launched 2011
    const month = +mo!
    const day = +d!
    if (month < 1 || month > 12 || day < 1 || day > 31) continue
    const hour = +h!
    const minute = +mi!
    const second = +s!
    if (hour > 23 || minute > 59 || second > 60) continue
    const ms = Date.UTC(year, month - 1, day, hour, minute, Math.min(second, 59))
    if (!Number.isFinite(ms)) continue
    return { ms, hasTime }
  }
  return null
}

const pad = (n: number, len = 2) => String(n).padStart(len, '0')

export function formatDateParts(ms: number): {
  year: string
  month: string
  day: string
  date: string
  time: string
  hour: string
  minute: string
  second: string
} {
  // Formatted as UTC on purpose: Snapchat metadata dates are UTC, and
  // deterministic filenames matter more than wall-clock adjustment until a
  // per-archive timezone override exists (Advanced Mode, later).
  const d = new Date(ms)
  const year = String(d.getUTCFullYear())
  const month = pad(d.getUTCMonth() + 1)
  const day = pad(d.getUTCDate())
  return {
    year,
    month,
    day,
    date: `${year}-${month}-${day}`,
    time: `${pad(d.getUTCHours())}-${pad(d.getUTCMinutes())}-${pad(d.getUTCSeconds())}`,
    hour: pad(d.getUTCHours()),
    minute: pad(d.getUTCMinutes()),
    second: pad(d.getUTCSeconds()),
  }
}

export function formatHumanDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

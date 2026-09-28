import type { MemoryMetadata, MediaKind } from './types'
import { parseSnapchatDate } from './datetime'

/**
 * Parser for memories_history.json — the metadata file in Snapchat "My Data"
 * exports. Built from the observed schema:
 *
 * {
 *   "Saved Media": [
 *     {
 *       "Date": "2020-12-21 12:18:40 UTC",
 *       "Media Type": "PHOTO" | "VIDEO" | "Photo" | "Video" | "Image" | …,
 *       "Location": "Latitude, Longitude: 45.95817, -66.6471" (or legacy
 *                   "Latitude: x, Longitude: y", or empty/N/A),
 *       "Media ID": "<uuid>" (absent in some vintages),
 *       "Media Download Url": "https://…" (empty in exports since ~May 2026)
 *       — the download key has also been seen as "Download Link".
 *     }
 *   ]
 * }
 *
 * Values are parsed, validated, and reduced to the fields we need. Nothing
 * from the file is echoed verbatim (privacy: captions/user content are never
 * retained).
 */

export interface ParsedHistory {
  records: MemoryMetadata[]
  /** Top-level JSON keys plus per-item keys (first item sample) — diagnostics only. */
  schemaKeys: string[]
  /** Human-facing parse problems (counts, never content). */
  issues: string[]
}

const LATLON_NEW = /Latitude,\s*Longitude:\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/i
const LATLON_OLD = /Latitude:\s*(-?\d+(?:\.\d+)?)[,;\s]+Longitude:\s*(-?\d+(?:\.\d+)?)/i

function parseLocation(value: unknown): { lat: number; lon: number } | null {
  if (typeof value !== 'string' || value.trim() === '' || /^n\/?a$/i.test(value.trim())) {
    return null
  }
  const m = LATLON_NEW.exec(value) ?? LATLON_OLD.exec(value)
  if (!m) return null
  const lat = Number(m[1])
  const lon = Number(m[2])
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null
  return { lat, lon }
}

function parseKind(value: unknown): MediaKind | null {
  if (typeof value !== 'string') return null
  const v = value.trim().toLowerCase()
  if (v === 'photo' || v === 'image') return 'photo'
  if (v === 'video') return 'video'
  return null
}

function parseId(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().toUpperCase()
  return /^[0-9A-F-]{16,64}$/.test(trimmed) ? trimmed : null
}

function parseUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (trimmed === '') return null
  try {
    const url = new URL(trimmed)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    return trimmed
  } catch {
    return null
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export function parseMemoriesHistory(json: unknown, sourceFile = 0): ParsedHistory {
  const issues: string[] = []
  const schemaKeys: string[] = []
  if (!isRecord(json)) {
    return { records: [], schemaKeys, issues: ['memories_history.json is not an object'] }
  }
  schemaKeys.push(...Object.keys(json))

  let list: unknown[] | null = null
  const direct = json['Saved Media']
  if (Array.isArray(direct)) {
    list = direct
  } else {
    // Fallback for future schema drift: first array of objects with a Date key.
    for (const value of Object.values(json)) {
      if (
        Array.isArray(value) &&
        value.length > 0 &&
        isRecord(value[0]) &&
        'Date' in value[0]
      ) {
        list = value
        issues.push('Saved Media key missing; used a fallback array')
        break
      }
    }
  }
  if (!list) {
    return { records: [], schemaKeys, issues: ['No "Saved Media" array found'] }
  }

  const records: MemoryMetadata[] = []
  let badDates = 0
  for (let i = 0; i < list.length; i++) {
    const entry = list[i]
    if (!isRecord(entry)) continue
    if (records.length === 0) schemaKeys.push(...Object.keys(entry))
    const dateMs = parseSnapchatDate(entry['Date'])
    if (dateMs === null && entry['Date'] !== undefined) badDates++
    records.push({
      index: i,
      dateMs,
      kind: parseKind(entry['Media Type']),
      mediaId: parseId(entry['Media ID'] ?? entry['Snap UUID']),
      lat: parseLocation(entry['Location'])?.lat ?? null,
      lon: parseLocation(entry['Location'])?.lon ?? null,
      downloadUrl: parseUrl(entry['Media Download Url'] ?? entry['Download Link']),
      sourceFile,
    })
  }
  if (badDates > 0) issues.push(`${badDates} entries had unreadable dates`)
  return { records, schemaKeys, issues }
}

/** Parses a JSON file's bytes, returning null instead of throwing on bad input. */
export function parseJsonSafe(bytes: Uint8Array): unknown | null {
  try {
    const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes)
    return JSON.parse(text)
  } catch {
    return null
  }
}

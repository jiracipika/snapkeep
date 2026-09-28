import type { ArchiveSession } from '@/lib/snapchat/session'
import type { MediaItem } from '@/lib/snapchat/types'

/**
 * Lazy thumbnail service: bounded LRU of small WebP object URLs with a
 * concurrency-limited extraction queue. Large archives never decode more
 * than the cache holds; evicted URLs are revoked promptly.
 */

interface CacheEntry {
  url: string
  bytes: number
}

const MAX_ENTRIES = 300
const MAX_CACHE_BYTES = 96 * 1024 * 1024
const CONCURRENCY = 4

export class ThumbnailService {
  private session: ArchiveSession
  private cache = new Map<string, CacheEntry>()
  private queue: MediaItem[] = []
  private queued = new Set<string>()
  private inflight = 0
  private listeners = new Set<() => void>()

  constructor(session: ArchiveSession) {
    this.session = session
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private notify() {
    for (const fn of this.listeners) fn()
  }

  /** Returns a ready object URL, or null while the thumbnail is pending. */
  get(item: MediaItem): string | null {
    const hit = this.cache.get(item.id)
    if (hit) {
      // Refresh LRU position
      this.cache.delete(item.id)
      this.cache.set(item.id, hit)
      return hit.url
    }
    if (!this.queued.has(item.id)) {
      this.queued.add(item.id)
      this.queue.push(item)
      this.pump()
    }
    return null
  }

  peek(item: MediaItem): string | null {
    return this.cache.get(item.id)?.url ?? null
  }

  private pump() {
    while (this.inflight < CONCURRENCY && this.queue.length > 0) {
      const item = this.queue.shift()!
      if (this.cache.has(item.id)) {
        this.queued.delete(item.id)
        continue
      }
      this.inflight++
      void this.makeThumb(item).finally(() => {
        this.inflight--
        this.queued.delete(item.id)
        this.pump()
      })
    }
  }

  private async makeThumb(item: MediaItem): Promise<void> {
    if (item.kind !== 'photo') return // videos use an icon placeholder for now
    try {
      const bytes = await this.session.extractBytes(item)
      if (bytes.length === 0) return
      const bitmap = await createImageBitmap(new Blob([new Uint8Array(bytes)]))
      const scale = Math.min(1, 480 / Math.max(bitmap.width, bitmap.height))
      const w = Math.max(1, Math.round(bitmap.width * scale))
      const h = Math.max(1, Math.round(bitmap.height * scale))
      const canvas = new OffscreenCanvas(w, h)
      canvas.getContext('2d')?.drawImage(bitmap, 0, 0, w, h)
      bitmap.close()
      const blob = await canvas.convertToBlob({ type: 'image/webp', quality: 0.75 })
      const url = URL.createObjectURL(blob)
      this.insert(item.id, { url, bytes: blob.size })
      this.notify()
    } catch {
      // Unreadable/unsupported image: leave without a thumbnail.
    }
  }

  private insert(id: string, entry: CacheEntry) {
    this.cache.set(id, entry)
    while (this.cache.size > MAX_ENTRIES || this.totalBytes() > MAX_CACHE_BYTES) {
      const oldest = this.cache.keys().next().value
      if (oldest === undefined) break
      const evicted = this.cache.get(oldest)
      this.cache.delete(oldest)
      if (evicted) URL.revokeObjectURL(evicted.url)
    }
  }

  private totalBytes(): number {
    let total = 0
    for (const e of this.cache.values()) total += e.bytes
    return total
  }

  dispose() {
    for (const e of this.cache.values()) URL.revokeObjectURL(e.url)
    this.cache.clear()
    this.queue = []
    this.listeners.clear()
  }
}

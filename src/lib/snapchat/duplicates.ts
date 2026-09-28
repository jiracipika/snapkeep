/**
 * Duplicate-scan sizing policy. Hashing requires the whole file in memory;
 * Snapchat snaps are tiny, but a camera-roll import or 60s 4K clip inside a
 * 2GB-per-part export could be huge. Above the cap a file is reported as
 * "skipped (too large to verify)" instead of risking the tab.
 */

export const DUPLICATE_HASH_MAX_BYTES = 512 * 1024 * 1024

export function hashableForDuplicates(size: number): boolean {
  return size > 0 && size <= DUPLICATE_HASH_MAX_BYTES
}

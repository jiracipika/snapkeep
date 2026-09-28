import { describe, expect, it } from 'vitest'
import {
  DUPLICATE_HASH_MAX_BYTES,
  hashableForDuplicates,
} from './snapchat/duplicates'
import { formatBytes } from './format'

describe('duplicate-scan sizing policy (2GB-per-part exports)', () => {
  it('hashes normal snaps and skips oversized files', () => {
    expect(hashableForDuplicates(1024)).toBe(true)
    expect(hashableForDuplicates(50 * 1024 * 1024)).toBe(true)
    expect(hashableForDuplicates(DUPLICATE_HASH_MAX_BYTES)).toBe(true)
    expect(hashableForDuplicates(DUPLICATE_HASH_MAX_BYTES + 1)).toBe(false)
    expect(hashableForDuplicates(2 * 1024 ** 3)).toBe(false) // a whole 2GB part
    expect(hashableForDuplicates(0)).toBe(false)
  })

  it('formats part-sized byte counts readably', () => {
    expect(formatBytes(2 * 1024 ** 3)).toBe('2.0 GB')
    expect(formatBytes(DUPLICATE_HASH_MAX_BYTES)).toBe('512.0 MB')
  })
})

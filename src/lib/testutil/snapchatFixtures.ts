import { strToU8, zipSync } from 'fflate'
import { buildStoreZip, noiseBytes } from './zipBuilder'

/**
 * Synthetic Snapchat archives covering the export layouts observed in the
 * wild. All bytes are fake; nothing here is real user data.
 */

export interface MemoryJsonEntry {
  Date?: string
  'Media Type'?: string
  Location?: string
  'Media ID'?: string
  'Media Download Url'?: string
  'Download Link'?: string
}

export function memoriesHistoryJson(entries: MemoryJsonEntry[]): Uint8Array {
  return strToU8(JSON.stringify({ 'Saved Media': entries }))
}

/** Minimal bytes with a real JPEG magic header (for thumbnail code later). */
export function fakeJpeg(seed: number, size = 2048): Uint8Array {
  const bytes = noiseBytes(seed, size)
  bytes[0] = 0xff
  bytes[1] = 0xd8
  bytes[2] = 0xff
  bytes[3] = 0xe0
  return bytes
}

/** Minimal bytes with a real MP4 ftyp box header. */
export function fakeMp4(seed: number, size = 4096): Uint8Array {
  const bytes = noiseBytes(seed, size)
  bytes.set([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d], 0)
  return bytes
}

let uuidCounter = 0
export function fakeUuid(): string {
  uuidCounter++
  const hex = (uuidCounter * 0x9e3779b9 >>> 0).toString(16).padStart(8, '0')
  return `${hex}-a11b-c22d-33ee-${hex.split('').reverse().join('')}4f5a`.toUpperCase()
}

/**
 * 2026-era export: media files inside the archive, paired with
 * memories_history.json. Includes overlays, a split video, and junk.
 */
export function buildModernExport(): Uint8Array {
  const idPhoto = fakeUuid()
  const idVideo = fakeUuid()
  const idSplit = fakeUuid()
  const idUnreferenced = fakeUuid()

  const entries: MemoryJsonEntry[] = [
    {
      Date: '2023-08-14 19:32:05 UTC',
      'Media Type': 'PHOTO',
      Location: 'Latitude, Longitude: 45.95817, -66.6471',
      'Media ID': idPhoto,
      'Media Download Url': '',
    },
    {
      Date: '2023-08-14 19:32:11 UTC',
      'Media Type': 'Video',
      Location: 'N/A',
      'Media ID': idVideo,
      'Media Download Url': '',
    },
    {
      Date: '2021-03-02 08:15:00 UTC',
      'Media Type': 'photo',
      'Media ID': idSplit,
      'Download Link': 'https://app.snapchat.com/hotspot/content?uuid=x',
    },
  ]
  const json = memoriesHistoryJson(entries)

  return zipSync({
    'json/memories_history.json': json,
    'html/memories_history.html': strToU8('<html>table of data</html>'),
    'json/account_history.json': strToU8('{"History":[]}'),
    [`memories/2023-08-14_${idPhoto.toLowerCase()}-main.jpg`]: fakeJpeg(1),
    [`memories/2023-08-14_${idPhoto.toLowerCase()}-overlay.png`]: noiseBytes(2, 512),
    [`memories/2023-08-14_${idVideo.toLowerCase()}-main.mp4`]: fakeMp4(3),
    [`memories/2021-03-02_${idSplit.toLowerCase()}-main_0.mp4`]: fakeMp4(4),
    [`memories/2021-03-02_${idSplit.toLowerCase()}-main_1.mp4`]: fakeMp4(5),
    // In the archive but not referenced by the JSON (orphan).
    [`memories/2020-01-01_${idUnreferenced.toLowerCase()}.jpg`]: fakeJpeg(6),
    '__MACOSX/memories/._junk.jpg': noiseBytes(7, 32),
    'memories/._resource.jpg': noiseBytes(8, 32),
    '.DS_Store': noiseBytes(9, 16),
    'other.txt': strToU8('not media'),
  })
}

/** Pre-2026 export: metadata + expiring links only, no media bytes. */
export function buildLinkOnlyExport(): Uint8Array {
  const id1 = fakeUuid()
  const id2 = fakeUuid()
  return zipSync({
    'json/memories_history.json': memoriesHistoryJson([
      {
        Date: '2019-06-01 10:00:00 UTC',
        'Media Type': 'PHOTO',
        Location: 'Latitude: 40.7128, Longitude: -74.0060',
        'Media ID': id1,
        'Media Download Url': 'https://app.snapchat.com/hotspot/content?uuid=a',
      },
      {
        Date: '2020-12-21 12:18:40 UTC',
        'Media Type': 'VIDEO',
        'Media ID': id2,
        'Download Link': 'https://app.snapchat.com/hotspot/content?uuid=b',
      },
    ]),
    'html/memories_history.html': strToU8('<html>data</html>'),
  })
}

/** In-app Memories export: media only, capture dates in filenames. */
export function buildInAppExport(): Uint8Array {
  return zipSync({
    '2023-08-14_19-32-05.jpg': fakeJpeg(10),
    '2023-08-14_19-32-11.mp4': fakeMp4(11),
    '2022-01-31.png': fakeJpeg(12, 512), // date-only, no time
    'IMG_4021.jpg': fakeJpeg(13, 512), // no date at all
  })
}

/** Hostile/messy archive: traversal-style names, odd extensions, no metadata. */
export function buildMessyExport(): Uint8Array {
  return buildStoreZip([
    { name: 'memories/2023-08-14_19-32-05_photo.jpg', data: fakeJpeg(14) },
    { name: 'memories/../..//evil_name<>.jpg', data: fakeJpeg(15, 256) },
    { name: 'memories/clip.heic', data: noiseBytes(16, 256) },
    { name: 'memories/video.MOV', data: fakeMp4(17, 256) },
    { name: 'CON', data: noiseBytes(18, 16) },
  ])
}

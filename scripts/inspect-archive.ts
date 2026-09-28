/**
 * Local Snapchat archive diagnostic tool — the "understand the ZIP first"
 * development utility. Prints structure ONLY: folder names, extensions,
 * JSON schema keys, counts. Never prints user content (no captions,
 * no locations, no usernames, no URLs beyond host names).
 *
 * Usage: npm run inspect -- path/to/extracted-folder-or.zip
 */
import { createReadStream, existsSync, statSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { inflateSync, strFromU8 } from 'fflate'

interface Entry {
  name: string
  size: number
  csize: number
  method: number
  offset: number
}

async function readRange(file: string, start: number, end: number): Promise<Uint8Array> {
  const len = end - start
  const fh = createReadStream(file, { start, end: end - 1 })
  const chunks: Buffer[] = []
  for await (const c of fh) chunks.push(c as Buffer)
  return new Uint8Array(Buffer.concat(chunks, len))
}

function u16(b: Uint8Array, p: number) {
  return b[p]! | (b[p + 1]! << 8)
}
function u32(b: Uint8Array, p: number) {
  return (b[p]! | (b[p + 1]! << 8) | (b[p + 2]! << 16) | (b[p + 3]! << 24)) >>> 0
}
function u64(b: Uint8Array, p: number) {
  return u32(b, p) + u32(b, p + 4) * 2 ** 32
}

async function readCentralDirectory(file: string, fileSize: number): Promise<Entry[]> {
  const scanStart = Math.max(0, fileSize - 66_000)
  const tail = await readRange(file, scanStart, fileSize)
  let eocd = -1
  for (let i = tail.length - 22; i >= 0; i--) {
    if (u32(tail, i) !== 0x06054b50) continue
    if (scanStart + i + 22 + u16(tail, i + 20) === fileSize) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error('not a zip')
  let cdOffset = u32(tail, eocd + 16)
  let cdSize = u32(tail, eocd + 12)
  let total = u16(tail, eocd + 10)
  if (cdOffset === 0xffffffff || cdSize === 0xffffffff || total === 0xffff) {
    const locStart = scanStart + eocd - 20
    const loc = await readRange(file, locStart, locStart + 20)
    if (u32(loc, 0) === 0x07064b50) {
      const z64Off = u64(loc, 8)
      const z64 = await readRange(file, z64Off, z64Off + 56)
      total = u64(z64, 32)
      cdSize = u64(z64, 40)
      cdOffset = u64(z64, 48)
    }
  }
  const cd = await readRange(file, cdOffset, cdOffset + cdSize)
  const entries: Entry[] = []
  let p = 0
  while (p + 46 <= cd.length && u32(cd, p) === 0x02014b50) {
    const method = u16(cd, p + 10)
    const csize0 = u32(cd, p + 20)
    const usize0 = u32(cd, p + 24)
    const nameLen = u16(cd, p + 28)
    const extraLen = u16(cd, p + 30)
    const commentLen = u16(cd, p + 32)
    let offset = u32(cd, p + 42)
    let csize = csize0
    let usize = usize0
    const extraStart = p + 46 + nameLen
    const extraEnd = extraStart + extraLen
    let ep = extraStart
    while (ep + 4 <= extraEnd) {
      const id = u16(cd, ep)
      const sz = u16(cd, ep + 2)
      if (id === 0x0001) {
        let f = ep + 4
        if (usize0 === 0xffffffff) {
          usize = u64(cd, f)
          f += 8
        }
        if (csize0 === 0xffffffff) {
          csize = u64(cd, f)
          f += 8
        }
        if (offset === 0xffffffff) {
          offset = u64(cd, f)
          f += 8
        }
        break
      }
      ep += 4 + sz
    }
    entries.push({
      name: new TextDecoder().decode(cd.subarray(p + 46, extraStart)),
      size: usize,
      csize,
      method,
      offset,
    })
    p = extraEnd + commentLen
  }
  return entries
}

async function extractJson(file: string, entry: Entry): Promise<unknown | null> {
  const header = await readRange(file, entry.offset, entry.offset + 30)
  const nameLen = u16(header, 26)
  const extraLen = u16(header, 28)
  const start = entry.offset + 30 + nameLen + extraLen
  const data = await readRange(file, start, start + entry.csize)
  const out = entry.method === 0 ? data : inflateSync(data)
  try {
    return JSON.parse(strFromU8(out))
  } catch {
    return null
  }
}

const PHOTO = new Set(['jpg', 'jpeg', 'png', 'heic', 'webp', 'gif'])
const VIDEO = new Set(['mp4', 'mov', 'm4v'])

function extOf(name: string): string {
  return name.split('.').pop()!.toLowerCase()
}

function isJunk(name: string): boolean {
  return /__MACOSX|(^|\/)\._|\.DS_Store|Thumbs\.db/i.test(name)
}

async function main() {
  const target = process.argv[2]
  if (!target) {
    console.error('Usage: npm run inspect -- <archive.zip | extracted-folder>')
    process.exit(1)
  }
  if (!existsSync(target)) {
    console.error(`No such path: ${target}`)
    process.exit(1)
  }

  const st = statSync(target)
  let entries: Entry[] = []
  let sourceFiles: string[] = []

  if (st.isFile() && /\.zip$/i.test(target)) {
    entries = await readCentralDirectory(target, st.size)
    sourceFiles = [path.basename(target)]
  } else if (st.isDirectory()) {
    // Folder of extracted ZIP parts (the usual mydata~*.zip situation)
    const zips = readdirSync(target).filter((f) => /\.zip$/i.test(f))
    if (zips.length > 0) {
      for (const z of zips) {
        const full = path.join(target, z)
        entries.push(...(await readCentralDirectory(full, statSync(full).size)))
        sourceFiles.push(z)
      }
    } else {
      // Already-extracted folder: walk it
      const walk = (dir: string, prefix = '') => {
        for (const name of readdirSync(dir)) {
          const full = path.join(dir, name)
          const s = statSync(full)
          if (s.isDirectory()) walk(full, `${prefix}${name}/`)
          else
            entries.push({
              name: `${prefix}${name}`,
              size: s.size,
              csize: s.size,
              method: 0,
              offset: 0,
            })
        }
      }
      walk(target)
      sourceFiles = [path.basename(target) + '/']
    }
  } else {
    console.error('Provide a .zip file or a folder of zip parts.')
    process.exit(1)
  }

  const media = entries.filter(
    (e) => !isJunk(e.name) && (PHOTO.has(extOf(e.name)) || VIDEO.has(extOf(e.name))),
  )
  const jsons = entries.filter((e) => /\.json$/i.test(e.name))
  const htmls = entries.filter((e) => /\.html?$/i.test(e.name))
  const junk = entries.filter((e) => isJunk(e.name))
  const extCounts = new Map<string, number>()
  for (const e of entries) {
    const ext = extOf(e.name)
    extCounts.set(ext, (extCounts.get(ext) ?? 0) + 1)
  }
  const folders = new Map<string, number>()
  for (const e of entries) {
    const top = e.name.includes('/') ? e.name.split('/')[0]! : '(root)'
    folders.set(top, (folders.get(top) ?? 0) + 1)
  }

  console.log('═══ Snapkeep archive diagnostics ═══')
  console.log(`source parts : ${sourceFiles.join(', ')}`)
  console.log(`entries      : ${entries.length} (${junk.length} packaging junk)`)
  console.log(
    `media        : ${media.length} (photos ${media.filter((m) => PHOTO.has(extOf(m.name))).length}, videos ${media.filter((m) => VIDEO.has(extOf(m.name))).length})`,
  )
  console.log(`json / html  : ${jsons.length} / ${htmls.length}`)
  console.log('extensions   :', [...extCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([e, c]) => `.${e}×${c}`).join('  '))
  console.log('top folders  :', [...folders.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([f, c]) => `${f}/×${c}`).join('  '))
  console.log('sample paths :')
  for (const e of media.slice(0, 5)) console.log(`  ${e.name} (${e.size} B)`)
  if (media.length > 5) console.log(`  … ${media.length - 5} more media files`)

  // Schema keys of the memories metadata (keys only — never values).
  if (st.isFile() && /\.zip$/i.test(target) && jsons.length > 0) {
    const hist = jsons.find((j) => /memories[_-]?history/i.test(j.name))
    if (hist) {
      console.log(`\nmemories_history.json: ${hist.name} (${hist.size} B)`)
      const parsed = await extractJson(target, hist)
      if (parsed && typeof parsed === 'object') {
        const topKeys = Object.keys(parsed as object)
        console.log(`  top-level keys: ${topKeys.join(', ')}`)
        const list = (parsed as Record<string, unknown>)['Saved Media']
        if (Array.isArray(list) && list.length > 0 && typeof list[0] === 'object') {
          console.log(`  records: ${list.length}`)
          console.log(`  item keys: ${Object.keys(list[0] as object).join(', ')}`)
        }
      } else {
        console.log('  (could not parse as JSON)')
      }
    }
  }
  console.log('\n(No user content is printed — structure only.)')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})


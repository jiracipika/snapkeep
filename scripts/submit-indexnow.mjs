#!/usr/bin/env node
// Submits the site's URLs to IndexNow (https://www.indexnow.org) — a shared
// ping endpoint that reaches Bing, Seznam, Yandex, and Naver. No account or
// API key signup needed: the key file in public/ proves site ownership.
//
// Usage: node scripts/submit-indexnow.mjs [baseUrl]
// (baseUrl defaults to https://snapkeeper.vercel.app)

import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const BASE = (process.argv[2] ?? 'https://snapkeeper.vercel.app').replace(/\/$/, '')
const HOST = new URL(BASE).host
const rootDir = fileURLToPath(new URL('../', import.meta.url))
const publicDir = `${rootDir}public`

// The key is the single .txt file in public/ whose name equals its content.
const keyFiles = readdirSync(publicDir).filter((f) => /^[0-9a-f]{32}\.txt$/.test(f))
if (keyFiles.length !== 1) {
  console.error(`Expected exactly one IndexNow key file in public/, found: ${keyFiles.join(', ') || 'none'}`)
  process.exit(1)
}
const key = keyFiles[0].replace(/\.txt$/, '')
if (readFileSync(`${publicDir}/${key}.txt`, 'utf8').trim() !== key) {
  console.error('IndexNow key file content does not match its filename')
  process.exit(1)
}

const urls = [
  `${BASE}/`,
  `${BASE}/guide/how-to-export-snapchat-memories/`,
  `${BASE}/guide/back-up-memories-before-deleting-snapchat/`,
  `${BASE}/guide/snapchat-my-data-explained/`,
]

const res = await fetch('https://api.indexnow.org/IndexNow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({
    host: HOST,
    key,
    keyLocation: `${BASE}/${key}.txt`,
    urlList: urls,
  }),
})

console.log(`IndexNow ${res.status}: submitted ${urls.length} URLs for ${HOST}`)
if (!res.ok) {
  console.error(await res.text())
  process.exit(1)
}

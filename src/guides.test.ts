import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { monetization } from './config/monetization'

// Drift guards for the static guide pages (guide/*/index.html). These pages
// are hand-written HTML that must stay consistent with the app's
// monetization config, brand SVGs, sitemap, and their own SEO heads — the
// same "no drift between config and content" philosophy as src/seo.test.ts.

const CANONICAL = 'https://snapkeeper.vercel.app'
const rootDir = new URL('../', import.meta.url)
const read = (p: string) => readFileSync(new URL(p, rootDir), 'utf8')

const GUIDE_DIRS = readdirSync(new URL('guide/', rootDir)).sort()
const KNOWN_GUIDE_SLUGS = [
  'back-up-memories-before-deleting-snapchat',
  'how-to-export-snapchat-memories',
  'is-snapchat-deleting-memories',
  'recover-deleted-snapchat-memories',
  'snapchat-my-data-explained',
  'transfer-snapchat-memories-to-new-phone',
]

const guideHtml = (slug: string) => read(`guide/${slug}/index.html`)

function metaContent(html: string, name: string): string {
  const m = html.match(new RegExp(`<meta\\s+name="${name}"\\s+content="([^"]+)"`))
  expect(m, `meta ${name} present`).not.toBeNull()
  return m![1]!
}

function canonical(html: string): string {
  const m = html.match(/<link rel="canonical" href="([^"]+)"/)
  expect(m, 'canonical link present').not.toBeNull()
  return m![1]!
}

function jsonLdGraph(html: string): Array<Record<string, unknown>> {
  const m = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)
  expect(m, 'JSON-LD block present').not.toBeNull()
  const parsed = JSON.parse(m![1]!) as { '@graph': Array<Record<string, unknown>> }
  return parsed['@graph']
}

function ghostPath(html: string): string {
  const matches = [...html.matchAll(/<path\s+d="(M16 6\.5[^"]+)"/g)].map((m) => m[1]!)
  expect(matches, 'exactly one ghost logo path per page').toHaveLength(1)
  return matches[0]!
}

describe('guides: pages exist and are registered', () => {
  it('has the three expected guide pages (no strays, no renames)', () => {
    expect(GUIDE_DIRS).toEqual(KNOWN_GUIDE_SLUGS)
    for (const slug of GUIDE_DIRS) {
      expect(existsSync(new URL(`guide/${slug}/index.html`, rootDir)), slug).toBe(true)
    }
  })

  it('vite builds every guide page as an MPA input', () => {
    const viteConfig = read('vite.config.ts')
    for (const slug of GUIDE_DIRS) {
      expect(viteConfig).toContain(`./guide/${slug}/index.html`)
    }
  })

  it('sitemap lists the homepage and every guide URL', () => {
    const sitemap = read('public/sitemap.xml')
    expect(sitemap).toContain(`<loc>${CANONICAL}/</loc>`)
    for (const slug of GUIDE_DIRS) {
      expect(sitemap).toContain(`<loc>${CANONICAL}/guide/${slug}/</loc>`)
    }
  })
})

describe('guides: SEO heads', () => {
  for (const slug of GUIDE_DIRS) {
    it(`${slug}: unique title, bounded description, canonical matching its URL`, () => {
      const html = guideHtml(slug)
      const title = html.match(/<title>([^<]+)<\/title>/)![1]!
      expect(title.length, 'title present and bounded').toBeGreaterThan(15)
      expect(title.length).toBeLessThan(70)
      const desc = metaContent(html, 'description')
      expect(desc.length, 'description bounded for snippets').toBeGreaterThan(50)
      expect(desc.length).toBeLessThanOrEqual(160)
      expect(canonical(html)).toBe(`${CANONICAL}/guide/${slug}/`)
      expect(html).toContain(`property="og:url" content="${CANONICAL}/guide/${slug}/"`)
      expect(html).toContain(`property="og:image" content="${CANONICAL}/og-image.png"`)
      expect(html).toContain('name="twitter:card" content="summary_large_image"')
    })

    it(`${slug}: structured data parses with breadcrumb and article/howto`, () => {
      const graph = jsonLdGraph(guideHtml(slug))
      const breadcrumb = graph.find((n) => n['@type'] === 'BreadcrumbList')
      expect(breadcrumb, 'BreadcrumbList node').toBeTruthy()
      const main = graph.find((n) => n['@type'] === 'HowTo' || n['@type'] === 'Article')
      expect(main, 'HowTo or Article node').toBeTruthy()
    })

    it(`${slug}: loads the shared theme module and AdSense loader`, () => {
      const html = guideHtml(slug)
      expect(html).toContain('<script type="module" src="/src/guides/theme.ts"></script>')
      expect(html).toContain(`adsbygoogle.js?client=${monetization.adsenseClient}`)
      expect(html).toContain("localStorage.getItem('snapkeep-theme')")
    })
  }

  it('shared theme module pulls in the shared stylesheet', () => {
    expect(read('src/guides/theme.ts')).toContain("import './guide.css'")
  })
})

describe('guides: monetization and brand consistency', () => {
  it('every guide donate link matches the app monetization config exactly', () => {
    for (const slug of GUIDE_DIRS) {
      const html = guideHtml(slug)
      const m = html.match(/class="btn-donate"\s*\n\s*href="([^"]+)"/)
      expect(m, `donate link present on ${slug}`).not.toBeNull()
      expect(m![1]).toBe(monetization.paypalDonateUrl)
    }
  })

  it('ghost logo SVG path is identical across the app and every guide page', () => {
    const icons = read('src/components/icons.tsx')
    const appPath = icons.match(/<path\s*\n\s*d="(M16 6\.5[^"]+)"/)![1]!
    for (const slug of GUIDE_DIRS) {
      expect(ghostPath(guideHtml(slug))).toBe(appPath)
    }
  })
})

describe('guides: internal link integrity', () => {
  it('every internal href resolves to a real route; every external href is https', () => {
    const routes = new Set(['/', ...KNOWN_GUIDE_SLUGS.map((s) => `/guide/${s}/`)])
    for (const slug of GUIDE_DIRS) {
      const html = guideHtml(slug)
      for (const [, href] of html.matchAll(/<a[^>]+href="([^"]+)"/g)) {
        if (href.startsWith('#')) continue
        if (href.startsWith('/')) {
          expect(routes.has(href), `${slug} links to ${href}`).toBe(true)
        } else {
          expect(href.startsWith('https://'), `${slug} external link ${href} is https`).toBe(true)
        }
      }
    }
  })

  it('each guide links the app and both sibling guides', () => {
    for (const slug of GUIDE_DIRS) {
      const html = guideHtml(slug)
      expect(html).toContain('href="/"')
      for (const other of KNOWN_GUIDE_SLUGS.filter((s) => s !== slug)) {
        expect(html).toContain(`href="/guide/${other}/"`)
      }
    }
  })
})

describe('indexnow', () => {
  it('key file in public/ is valid: 32-hex name matching its content', () => {
    const keyFiles = readdirSync(new URL('public/', rootDir)).filter((f) =>
      /^[0-9a-f]{32}\.txt$/.test(f),
    )
    expect(keyFiles, 'exactly one key file').toHaveLength(1)
    const key = keyFiles[0]!.replace(/\.txt$/, '')
    expect(read(`public/${keyFiles[0]}`).trim()).toBe(key)
  })

  it('submit script covers the homepage and every guide URL', () => {
    const script = read('scripts/submit-indexnow.mjs')
    expect(script).toContain("'https://api.indexnow.org/IndexNow'")
    expect(script).toContain("`${BASE}/`")
    for (const slug of KNOWN_GUIDE_SLUGS) {
      expect(script).toContain(`/guide/${slug}/`)
    }
  })
})

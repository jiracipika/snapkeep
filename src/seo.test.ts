import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { FAQS } from './config/seo'

const CANONICAL = 'https://snapkeeper.vercel.app/'
const rootDir = new URL('../', import.meta.url)
const read = (p: string) => readFileSync(new URL(p, rootDir), 'utf8')

const indexHtml = read('index.html')
const landingSource = read('src/app/Landing.tsx')

function jsonLd(): { '@graph': Array<Record<string, unknown>> } {
  const m = indexHtml.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)
  expect(m, 'JSON-LD block present in index.html').not.toBeNull()
  return JSON.parse(m![1]!)
}

describe('seo: head tags', () => {
  it('has title, description, and canonical', () => {
    expect(indexHtml).toContain(
      '<title>Snapkeep — Export Snapchat Memories as Photos &amp; Videos</title>',
    )
    expect(indexHtml).toMatch(
      new RegExp(`<link rel="canonical" href="${CANONICAL.replace(/\//g, '\\/')}" />`),
    )
    const desc = indexHtml.match(/name="description"\s+content="([^"]+)"/)
    expect(desc, 'meta description present').not.toBeNull()
    expect(desc![1]!.length).toBeGreaterThan(50)
    expect(desc![1]!.length).toBeLessThanOrEqual(160)
  })

  it('has complete Open Graph and Twitter card tags with absolute URLs', () => {
    expect(indexHtml).toContain(`property="og:url" content="${CANONICAL}"`)
    expect(indexHtml).toContain('property="og:site_name" content="Snapkeep"')
    expect(indexHtml).toContain(`property="og:image" content="${CANONICAL}og-image.png"`)
    expect(indexHtml).toContain('property="og:image:width" content="1200"')
    expect(indexHtml).toContain('property="og:image:height" content="630"')
    expect(indexHtml).toContain('name="twitter:card" content="summary_large_image"')
    expect(indexHtml).toContain(`name="twitter:image" content="${CANONICAL}og-image.png"`)
  })

  it('has a noscript fallback so non-JS crawlers see real content', () => {
    expect(indexHtml).toMatch(/<noscript>[\s\S]*?<h1[\s\S]*?Snapchat Memories[\s\S]*?<\/noscript>/)
  })
})

describe('seo: structured data', () => {
  it('parses and declares a free WebApplication', () => {
    const ld = jsonLd()
    const app = ld['@graph'].find((n) => n['@type'] === 'WebApplication')
    expect(app, 'WebApplication node').toBeTruthy()
    expect(app!.url).toBe(CANONICAL)
    expect(app!.isAccessibleForFree).toBe(true)
    const offers = app!.offers as Record<string, unknown>
    expect(offers.price).toBe('0')
  })

  it('FAQPage matches the visible FAQ content exactly (no drift)', () => {
    const ld = jsonLd()
    const faq = ld['@graph'].find((n) => n['@type'] === 'FAQPage')
    expect(faq, 'FAQPage node').toBeTruthy()
    const mainEntity = faq!.mainEntity as Array<Record<string, unknown>>
    expect(mainEntity).toHaveLength(FAQS.length)
    for (const [i, f] of FAQS.entries()) {
      expect(mainEntity[i]!.name).toBe(f.q)
      expect((mainEntity[i]!.acceptedAnswer as Record<string, unknown>).text).toBe(f.a)
    }
    // the landing page renders this exact config visibly
    expect(landingSource).toContain("from '@/config/seo'")
    expect(landingSource).toContain('FAQS.map')
  })
})

describe('seo: crawler files', () => {
  it('robots.txt allows all and points at the sitemap', () => {
    const robots = read('public/robots.txt')
    expect(robots).toContain('User-agent: *')
    expect(robots).toContain('Allow: /')
    expect(robots).toContain(`Sitemap: ${CANONICAL}sitemap.xml`)
  })

  it('sitemap.xml lists the canonical URL', () => {
    const sitemap = read('public/sitemap.xml')
    expect(sitemap).toContain(`<loc>${CANONICAL}</loc>`)
    expect(sitemap).toContain('</urlset>')
  })

  it('og-image.png exists as a real 1200×630 PNG', () => {
    const buf = readFileSync(new URL('public/og-image.png', rootDir))
    expect(buf.length).toBeGreaterThan(10_000)
    expect([...buf.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    expect(buf.readUInt32BE(16)).toBe(1200)
    expect(buf.readUInt32BE(20)).toBe(630)
  })
})

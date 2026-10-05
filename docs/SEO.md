# Snapkeep SEO — working checklist ("skills MD")

Goal: rank for Snapchat Memories export/transfer searches so organic traffic funds the
AdSense revenue. Canonical URL: **https://snapkeeper.vercel.app/** (one page = one URL;
everything else 301s to it via Vercel).

References this checklist is built from:

- Google Search Central — [Introduction to structured data](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data)
- [Front-End-Checklist (GitHub)](https://github.com/thedaviddias/Front-End-Checklist) — SEO section
- Google Search Central — [SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide)

## Target keywords

| Intent | Query | Covered by |
| --- | --- | --- |
| Export | export snapchat memories / save snapchat memories | title, h1, FAQ |
| How-to | how to download snapchat memories / snapchat data export | FAQ Q2, How-it-works |
| Tool | snapchat memories to photos / snapchat my data zip viewer | description, features |
| Trust | is snapchat data export safe / private | FAQ Q3/Q5, privacy copy |

## Shipped (2026-10-05)

- [x] Unique 55-char title with primary keyword ("Export Snapchat Memories…")
- [x] 155-char meta description with benefit + privacy differentiator
- [x] `<link rel="canonical">` to the live domain
- [x] Full Open Graph set (og:url, og:site_name, og:image 1200×630 + dimensions/alt/locale)
- [x] Twitter `summary_large_image` card
- [x] JSON-LD `@graph`: `WebApplication` (free offer, featureList) + `FAQPage`
- [x] FAQPage mirrored by a **visible** FAQ section on the landing page (Google requires
      the marked-up content to be user-visible; `src/seo.test.ts` fails on any drift)
- [x] `public/robots.txt` (allow all + Sitemap pointer)
- [x] `public/sitemap.xml` (single canonical URL, lastmod 2026-10-05)
- [x] `public/og-image.png` — rendered from `/tmp/snapkeep-og.html` recipe with
      chrome-headless-shell at 1200×630 (regenerate if branding changes)
- [x] `<noscript>` landing copy so non-JS crawlers/link-unfuzzers see real content
- [x] `lang="en"`, one `h1`, semantic `h2`/`h3` outline, `og:locale`
- [x] preconnect to the AdSense origin (keeps LCP clean with ads enabled)
- [x] Tests: `src/seo.test.ts` pins head tags, JSON-LD validity, FAQ sync, robots,
      sitemap, and PNG dimensions

## Next (user actions + future work)

- [ ] **Google Search Console**: add property `https://snapkeeper.vercel.app/`, verify
      (I can drop in the verification meta tag on request), submit `sitemap.xml`
- [ ] **Bing Webmaster Tools**: import site from GSC in one click
- [ ] Real usage/feedback content: a short "How it works" guide page or blog post per
      keyword cluster — single-page SPAs cap out; more indexed pages = more queries
- [ ] Backlinks: share on r/Snapchat / X where the tool genuinely answers someone
      (Reddit links are nofollow but drive first-wave traffic that earns natural links)
- [ ] FAQ rich results caveat: Google now shows FAQ rich snippets mainly for
      government/health sites, but the markup still helps entity understanding — keep it
- [ ] Monitor AdSense "Sites" tab until snapkeeper.vercel.app shows **Ready**;
      Search Console performance is the traffic dashboard (no analytics on-site, by design)

## Rules this doc enforces

- Never claim uploads don't happen while adding something that uploads (privacy copy =
  implementation; Snapkeep stays 100% client-side).
- Social unfurlers (iMessage, Slack, X) do NOT run JS — all preview tags must stay in
  static `index.html`, never injected from React.
- One canonical URL; the `www.`/apex variants redirect on Vercel — don't add more
  `<link rel="canonical">` variants or sitemap entries without updating the tests.

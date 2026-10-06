# Monetization — state and runbook

Snapkeep's revenue rails, what's live, and the exact remaining steps.
Pair with `docs/REVENUE-LEDGER.md` (the scoreboard).

## Status (2026-10-06)

| Rail | State | Blocker |
| --- | --- | --- |
| PayPal donate (header) | **Live** — `paypal.com/donate` button on every page | none; earns with existing traffic today |
| AdSense display slots | Wired end-to-end in code (loader, `ads.txt`, `AdSlot` components with house-card fallback) | **3 ad-unit IDs must be created in the AdSense dashboard** (human, ~5 min) |
| AdSense Auto ads | Loader script present on app + guide pages, so auto units serve the moment the toggle is on | check toggle in dashboard |
| Traffic | 3 guide pages + sitemap + IndexNow + internal linking shipped | Google re-crawl takes days–weeks |
| Analytics | Vercel Web Analytics on app + guides | none — read it in the Vercel dashboard → snapkeep → Analytics |

## The 5-minute human checklist (only steps needing dashboard access)

1. **Create the 3 ad units** — AdSense → Ads → By ad unit → New ad unit (Display ads):
   - `snapkeep-rail-1` → fixed size **160×600**
   - `snapkeep-rail-2` → fixed size **160×600**
   - `snapkeep-bottom` → **Responsive** display
   Paste the numeric slot IDs into `src/config/monetization.ts` → `adSlots.rail[0]`,
   `adSlots.rail[1]`, `adSlots.bottom` (or hand them over — wiring + deploy is a
   2-minute change). Empty IDs intentionally render the house card instead of an
   illegal empty ad unit, so nothing breaks meanwhile.
2. **Check Auto ads** (Ads → Auto ads): if enabled for snapkeeper.vercel.app, anchor/
   vignette units are already eligible to serve on top — no code needed.
3. **Google Search Console** (optional but valuable): verify `snapkeeper.vercel.app`
   (HTML-meta method), then submit `https://snapkeeper.vercel.app/sitemap.xml`. Bing
   and friends are already covered by IndexNow (key file lives in `public/`, submit
   via `node scripts/submit-indexnow.mjs` after each deploy).

## Hard lines (why some "growth" tactics are absent)

- No incentivized clicks, no "click our ads" schemes, no fake download buttons.
- Ads are labeled "Ad", the privacy line (archive never leaves the device) is
  repeated everywhere, and ads never intercept the tool's core flow.
- Guide pages are original, accurate content — no doorway spam.

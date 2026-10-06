# Monetization — state and runbook

Snapkeep's revenue rails, what's live, and the exact remaining steps.
Pair with `docs/REVENUE-LEDGER.md` (the scoreboard).

## Status (2026-10-06)

| Rail | State | Blocker |
| --- | --- | --- |
| PayPal donate (header) | **Live** — `paypal.com/donate` button on every page | none; earns with existing traffic today |
| Stripe card tip (header) | **Code-ready** — "Tip" button renders automatically once a link is configured | You create a **Stripe Payment Link** (~2 min; the Stripe *account* itself is KYC + bank, human-only) |
| AdSense display slots | Wired end-to-end in code (loader, `ads.txt`, `AdSlot` components with house-card fallback) | **3 ad-unit IDs must be created in the AdSense dashboard** (human, ~5 min) |
| AdSense Auto ads | Loader script present on app + guide pages, so auto units serve the moment the toggle is on | check toggle in dashboard |
| Traffic | 3 guide pages + sitemap + IndexNow + internal linking shipped | Google re-crawl takes days–weeks |
| Analytics | Vercel Web Analytics on app + guides | none — read it in the Vercel dashboard → snapkeep → Analytics |

## The 5-minute human checklist (only steps needing dashboard access)

0. **Stripe card tip** — [dashboard.stripe.com](https://dashboard.stripe.com) →
   Payment links → New → one-time product "Tip for Snapkeep" → enable
   **"pay what you want"** → copy the `https://buy.stripe.com/…` link → paste
   it into `src/config/monetization.ts` → `stripeTipUrl` (or hand it over).
   The header "Tip" button appears automatically; validation
   (`tipLink` in `src/lib/monetization.ts`) refuses anything that isn't a
   buy.stripe.com payment link, so a bad paste can't ship. Note: the Stripe
   account itself (KYC, bank account) is human-only — no CLI, Vercel's or
   Stripe's, can create it. Static guide pages stay PayPal-only until this
   link exists, then it gets hardcoded there too (tests pin no drift).

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

## Multi-site rollout (2026-10-06, same pub account)

Loader + `ads.txt` shipped on: gangsign-gg, auracard, signflow, outfitweather,
vindica, avolab.ca, aetherhands, fingerjam, handstrument, Dashverse,
ZenithShift. Remaining per-site step (dashboard): AdSense → Sites → **Add site**
→ enter URL → **Request review** (code is already live, so review can pass).
Do them in batches — Google reviews each site individually. Skipped for now:
Godot-exported games (need an export-template patch + rebuild), pitch-therapy
(env-blocked), santosg-resume (not ours to monetize), newsltr.ca (thin landing).

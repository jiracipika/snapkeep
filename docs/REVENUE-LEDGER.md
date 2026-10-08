# Snapkeep revenue ledger — the scoreboard

House rule: **every $1 earned = one reel watched** 📱
Update this file whenever a rail pays out or a change ships. No estimates
counted — only observed payouts.

## Baseline

- 2026-10-06 — Rails audited: PayPal donate **live** since commit `eb8ca93`;
  AdSense approved (`pub-4128325832827761`, `ads.txt` valid) but serving **$0**
  because ad-unit slot IDs were never created. Zero analytics before today, so
  pre-2026-10-06 traffic is unknown.

## Actions shipped (traffic engine)

- 2026-10-06 — 3 original guide pages (export walkthrough / backup-before-delete /
  My Data explainer) with HowTo+Article+Breadcrumb structured data, cross-linked
  with the app, in the sitemap.
- 2026-10-06 — Vercel Web Analytics on app + guides (traffic becomes measurable).
- 2026-10-06 — IndexNow key + `scripts/submit-indexnow.mjs` (Bing/Seznam/Yandex/Naver).
- 2026-10-06 — `docs/MONETIZATION.md`: the 5-minute human checklist (3 ad-unit IDs).
- 2026-10-06 — Stripe-ready tip rail: "Tip" card button (header, next to Donate)
  renders automatically once a Stripe Payment Link is pasted into
  `src/config/monetization.ts` → `stripeTipUrl`; strict `tipLink()` validation
  + tests. Button hidden while unconfigured.
- 2026-10-06 — **AdSense ad units CREATED and wired** (this is the day ads
  went live): `snapkeep-rail-1` 160×600 → slot `8284596304`, `snapkeep-rail-2`
  160×600 → `2601769648`, `snapkeep-bottom` responsive → `2292893863`.
  Committed `0baea46`, deployed, all 3 IDs verified in the served bundle.
  First ad impressions should serve within minutes–an hour.
- 2026-10-06 — Dashboard (via computer-use sign-in): 4 of the 11 prepped sites
  added + ownership-verified + review requested — hand-signs-not-crimes,
  auracard (code method), signflow-five + outfitweather (ads.txt method; the
  code-snippet crawler failed on both, ads.txt passed). Remaining 7 sites are
  code-ready; dashboard began throttling the add-site dialog after 5 adds in
  an hour — finish them in a later session (each ≈1 min: New site → URL →
  Save → Verify via ads.txt → Request review).
- 2026-10-06 — Multi-site AdSense rollout (same pub `ca-pub-4128325832827761`):
  loader + `ads.txt` shipped on 11 more properties — gangsign-gg, auracard,
  signflow, outfitweather, vindica, avolab.ca, aetherhands, fingerjam,
  handstrument, Dashverse, ZenithShift — all tests/typechecks green, all
  pushed (Vercel auto-deploys). None can serve ads until each is added in the
  AdSense dashboard and passes site review (human/agent-with-login step).
  Godot-exported games (breakrun, friday-evacuation, printshop-sim) skipped
  this pass — loader needs an export-template patch + rebuild.
- 2026-10-07 — **Dashboard tail finished (11/11 sites submitted)**: the
  add-site throttle lifted; vindica, avolab.ca, aetherhands, fingerjam,
  handstrument-two, infinite-side-scroller (Dashverse) and nomorejetlag
  (ZenithShift) all added → ownership-verified via ads.txt → review
  requested. vindica flipped to "Getting ready" within minutes; signflow and
  outfitweather ads.txt status flipped to "Authorized" overnight.
- 2026-10-07 — **Auto ads confirmed ON for snapkeeper** (Ads → By site);
  other 11 sites show OFF — irrelevant until each passes review; flip
  per-site after approval (one click each).
- 2026-10-07 — **Google Search Console wired**: property
  `https://snapkeeper.vercel.app/` created and VERIFIED instantly (the
  `google634507300b6f677a.html` file shipped 2026-10-06 passed first try —
  reached via the `?resource_id=` deep link after the add-property dialog
  kept dying), and `sitemap.xml` submitted ("Sitemap submitted
  successfully"; first fetch pending).

- 2026-10-07 — **SEO content slice (+2 guides, 414a6a4)**: `transfer-snapchat-memories-to-new-phone` (HowTo schema;
  targets "transfer snapchat memories to new phone") and `recover-deleted-snapchat-memories` (Article schema; honest
  paths + scam warning; targets "recover deleted snapchat memories"). Cross-linked from the app footer and all 5
  guides (each guide now links the other 4 + home), sitemap 6 URLs, IndexNow 200 (6 URLs submitted), GSC property
  live → both new URLs inspected + "Indexing requested". Tests 103 green.

## Payouts (observed only)

| Date | Rail | Amount | Reels earned |
| --- | --- | --- | --- |
| — | — | $0.00 | 0 |

## Expectations, honestly

Utility-tool display RPMs run roughly $0.5–$5 per 1,000 pageviews; donations
convert at well under 1%. First dollar ≈ a few hundred visits with ads live —
or a single generous coffee drinker. Traffic is the bottleneck; content pages
are the lever that compounds.

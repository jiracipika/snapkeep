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
- 2026-10-06 — Multi-site AdSense rollout (same pub `ca-pub-4128325832827761`):
  loader + `ads.txt` shipped on 11 more properties — gangsign-gg, auracard,
  signflow, outfitweather, vindica, avolab.ca, aetherhands, fingerjam,
  handstrument, Dashverse, ZenithShift — all tests/typechecks green, all
  pushed (Vercel auto-deploys). None can serve ads until each is added in the
  AdSense dashboard and passes site review (human/agent-with-login step).
  Godot-exported games (breakrun, friday-evacuation, printshop-sim) skipped
  this pass — loader needs an export-template patch + rebuild.

## Payouts (observed only)

| Date | Rail | Amount | Reels earned |
| --- | --- | --- | --- |
| — | — | $0.00 | 0 |

## Expectations, honestly

Utility-tool display RPMs run roughly $0.5–$5 per 1,000 pageviews; donations
convert at well under 1%. First dollar ≈ a few hundred visits with ads live —
or a single generous coffee drinker. Traffic is the bottleneck; content pages
are the lever that compounds.

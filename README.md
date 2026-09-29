# Snapkeep

Turn your Snapchat data export into normal photos and videos you can actually keep — free, and processed entirely in your browser.

**Live site: [https://snapkeeper.vercel.app](https://snapkeeper.vercel.app)**

> ## 🔒 Your Snapchat archive is processed locally in your browser. Your photos and videos are not uploaded to this application's servers.
>
> There is no backend that receives your media: the ZIP is opened, scanned,
> renamed, and repacked by JavaScript running on your own device. You can
> verify this — open your browser's network tab while processing an archive,
> or read the code in `src/lib/`.

Snapkeep is not affiliated with Snap Inc. Snapchat is a trademark of Snap Inc.

---

## What it does

1. You request your data from Snapchat (accounts.snapchat.com → My Data, with
   "Export your Memories" enabled) and download the ZIP(s).
2. You drop the ZIP on [Snapkeep](https://snapkeeper.vercel.app).
3. Everything is processed locally: the archive is scanned, Snapchat
   Memories metadata is parsed and matched to media, capture dates are
   recovered, and sensible filenames/folders are generated.
4. You download a clean, organized ZIP — your original archive is never
   modified.

Two modes, selected on the home screen:

### Easy Mode (default) — "Just get my photos and videos."

One flow, no configuration questions:

```
Drop your Snapchat ZIP
        ↓
Finding your photos and videos…
        ↓
1,824 Memories found
1,310 Photos · 514 Videos
From March 4, 2017 → To August 18, 2026
        ↓
[ Download My Memories ]
```

- Filenames like `2023-08-14_19-32-05_photo.jpg` (collisions become `_2`, `_3`…)
- Organized as `Snapchat Memories/<year>/…`, photos and videos together
- Dates are recovered from `memories_history.json` first, then from
  filename dates, then from archive timestamps — nothing is invented
- Capture dates (and GPS where present) are embedded losslessly into the
  exported files, so **Google Photos and Apple Photos sort and map them
  correctly** when you back the files up
- "Review in Advanced Mode" keeps the same session — no re-import

### Advanced Mode — "Review metadata, naming, folders, duplicates, and export options."

- **Browse**: virtualized thumbnail grid (tens of thousands of items),
  filters (photos / videos / unmatched / undated / overlays), search, sort,
  multi-select
- **Inspector**: per-item metadata — original ZIP path, date source and
  confidence, Media ID, proposed filename, split-video grouping, paired
  overlays. Values that don't exist are never fabricated
- **Naming & Folders**: filename templates (`{date}_{time}_{type}`,
  `{original}`, `{id}`, …) with live previews; folder strategies (year,
  year/month, photos/videos, flat); overlay and split-segment inclusion
- **Duplicates**: conservative SHA-256 byte-hash detection, review-first —
  nothing is removed automatically
- **Archive Info**: layout detection, file-type and folder tallies, JSON
  schema keys (structure only, never content)
- **Export**: scope = selection or current filter minus duplicate
  exclusions, optional `snapchat-export-report.json`

## Supported Snapchat exports

Snap has changed the export format repeatedly; Snapkeep handles the layouts
seen in the wild:

| Layout | What's inside | What Snapkeep does |
|---|---|---|
| Modern (Feb 2026+) | Media files in `memories/` (`<date>_<uuid>-main.jpg/.mp4` + `-overlay.png`), `json/memories_history.json` | Matches media ↔ metadata by Media ID, renames & organizes |
| Older (pre-2026) | `memories_history.json` with download URLs, no media files | Explains honestly, exports an organized link manifest (links expire — request a new export with Memories enabled) |
| In-app Memories export | Bare media files with capture dates in filenames | Dates recovered from filenames |
| Multi-part | `mydata~*.zip` sets | Drop all parts together; treated as one export |

Also handled: case variations in `Media Type`, both historical `Location`
formats, empty download-URL fields, `__MACOSX`/AppleDouble junk, zip64,
oversized multi-GB archives.

## Privacy

- **No uploads.** All parsing, matching, thumbnailing and ZIP creation runs
  in your browser (Web APIs only; no server-side processing exists).
- **No analytics.** The site ships zero analytics or tracking scripts.
- **Ads, not data.** The page carries Google AdSense ad slots (see
  [Monetization](#monetization)). Ad requests never contain anything from your
  archive — no filenames, dates, locations or bytes — because that data never
  leaves the device.
- **No third-party requests with your data.** Nothing from your archive —
  filenames, dates, locations, captions, or bytes — ever leaves the device.
- The optional export report contains paths, dates and sources only; GPS and
  captions are excluded unless you explicitly enable locations.
- Your original archive is opened read-only; exports are brand-new ZIPs.

## Monetization

Snapkeep stays free through non-invasive ads (Google AdSense). The layout is
designed around the ads, never the other way around:

- Two slim 160px side rails, shown only on screens ≥1280px wide so the main
  column keeps more than a 4:3 width-to-height share of the viewport.
- One responsive leaderboard band at the very bottom of the page.
- While an archive is processing, each rail carries an extra unit.
- Friendly house cards ("Ads keep Snapkeep running") fill any slot without a
  configured ad unit — no empty ad boxes, ever.

Configuration lives in `src/config/monetization.ts`:

- `adsenseClient` — the `ca-pub-…` publisher ID; the matching loader script is
  in `index.html` `<head>` (this is also the AdSense site-ownership snippet).
- `adSlots.rail` / `adSlots.bottom` — ad-unit IDs from AdSense → Ads → By ad
  unit. Paste IDs to replace the house cards with real units: two wide
  skyscrapers (160×600) for the rails, one responsive display unit for the
  bottom band.
- `public/ads.txt` — served at `/ads.txt`; keep its `pub-…` line in sync with
  the AdSense account.

A yellow **Donate** button (heart icon) in the header links to the
maintainer's PayPal "buy me a coffee" page — configured via
`paypalDonateUrl` in the same config file.

Operational notes:

- With **Auto ads** enabled in the AdSense dashboard, Google may place
  additional units on its own. Turn off anchor and vignette formats there
  (Ads → By site → Auto ads) to keep the page non-invasive.
- For EEA/UK visitors, enable Google's consent messaging (AdSense → Privacy &
  messaging) so ad personalization follows consent rules.

## Development setup

Requirements: Node 20+ (tested on 22/24/26), npm.

```bash
git clone https://github.com/jiracipika/snapkeep
cd snapkeep
npm install
npm run dev          # local dev server
```

Useful scripts:

```bash
npm test             # vitest suite (51 tests: zip engine, parsers, matching, e2e)
npm run typecheck    # tsc, strict
npm run lint         # oxlint
npm run build        # typecheck + production build to dist/
npm run inspect -- path/to/export.zip   # local archive diagnostics (structure only)
```

The codebase keeps parsing, matching, naming and export as separate layers
(`src/lib/zip`, `src/lib/snapchat`, `src/lib/media`, `src/lib/export`); UI
lives in `src/app` and `src/components`. Test fixtures build synthetic
Snapchat archives — **never commit a real Snapchat export.**

## Production build & deployment

```bash
npm run build        # outputs dist/
npm run preview      # serve the production build locally
```

Deployment is Vercel with the GitHub integration: pushes to `main`
auto-deploy production. The app is a static SPA — no server functions —
which is what makes the local-processing guarantee possible.

## Security design

Archive input is treated as hostile:

- **ZIP parsing**: hand-rolled central-directory reader; entry sizes,
  offsets and ratios are validated; entry counts and uncompressed sizes are
  capped; compression-bomb ratios are rejected; CRC-32 is verified on every
  extracted byte; encrypted/unsupported entries fail loudly
- **Path safety**: ZIP entry names are never used as output paths —
  filenames are generated and sanitized (Windows reserved names, control
  characters, `/:*?"<>|`, trailing dots); output paths are assert-checked
  against traversal (`..`, absolute, NUL, depth)
- **No code execution from data**: Snapchat HTML files are never rendered;
  JSON is parsed defensively with schema validation; all user-visible text
  passes through React's escaping (no `dangerouslySetInnerHTML`)
- **Memory bounds**: the archive is read by byte-range, media streams in
  4 MB chunks, thumbnails live in a bounded LRU — a 2 GB phone library
  doesn't exhaust a phone browser (very large exports still recommend
  desktop; see limitations)

## Known limitations

- **Metadata-only exports** (pre-2026, no media inside): Snapkeep can't
  recover bytes that were never in the ZIP. It exports an organized link
  manifest; the links themselves expire within days.
- **Video thumbnails** are icons for now (frame extraction is planned);
  photos get real lazy thumbnails.
- **Split videos** are detected and grouped (segments stay in filename
  order) but not stitched into one file yet.
- **Overlay layers** are exported as separate paired files; canvas
  compositing (baking captions/stickers onto the image) is planned.
- **Video GPS** is not embedded yet (photos are); QuickTime `©xyz` atoms
  are planned.
- **Timezone**: Snapchat stores UTC; filenames use the UTC timestamp for
  determinism (a per-archive timezone offset is planned).
- **Very large archives on phones** may hit browser memory limits during
  export; use a desktop for multi-GB libraries.
- HEIC photos can't receive EXIF write-back in-browser (Snapchat exports
  are JPEG/MP4, so this rarely matters).

See [docs/ROADMAP.md](docs/ROADMAP.md) for what's next and why.

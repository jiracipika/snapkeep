# Roadmap & competitive analysis

Researched 2026-09-28 against the current landscape: FixMyExport
(fixmyexport.com — installable app, free ≤200 files, $14.99 one-time),
MemoriesExport (memories-export.com — web version uploads to cloud),
SnapSavior (paused since May 2026 when Snapchat removed download URLs), and
open-source tooling (All-In-One-Snapchat-Downloader and several
link-era scripts, most now broken).

## Where Snapkeep wins today

- **Only true zero-install, zero-upload option.** FixMyExport requires
  installing an unsigned binary per OS/arch (plus FFmpeg/VLC); competitor
  web tools upload your archive to their servers. Snapkeep runs entirely in
  the browser.
- **Free and unlimited** vs the 200-file free cap / $15 paywall.
- **Honest handling of the May-2026 format change** (download URLs removed)
  that broke most link-era tools.
- In-browser Advanced workspace (browse/inspect/rename/dedupe) that no
  competitor has at all.

## Feature gaps vs competitors (planned order)

1. **Video thumbnails & frame preview** — extract poster frames via
   `<video>` + canvas with a bounded queue (P1).
2. **Overlay compositing** — bake `-overlay.png` caption/sticker layers onto
   base photos via canvas (FixMyExport charges for this; video overlays need
   ffmpeg.wasm or WebCodecs) (P1).
3. **Split-video stitching** — segments are detected and ordered; lossless
   concat via remux (WebCodecs/mp4 box surgery) so a 60s snap becomes one
   file (P2).
4. **Video GPS (`©xyz` atoms)** — photo GPS ships; QuickTime GPS for Apple
   Photos maps on videos is the remaining half (P2).
5. **Timezone override** — Snapchat stores UTC; offer per-archive offset
   (auto-suggest from GPS via offline city dataset) for users whose memories
   "feel" like local time (P2).
6. **Export-to-cloud (user's own Drive/Dropbox)** — OAuth + resumable
   upload from the browser for low-storage phones; stays privacy-first
   because it goes to the user's own account (P3).
7. **Chat media mode** — per-conversation grouping from chat exports
   (P3).
8. **HEIC write-back** — blocked on a pure-JS ISOBMFF EXIF item writer;
   niche since Snapchat exports JPEG (P3, maybe never).

## Format quirks the parser handles (source of truth: observed exports)

- `memories_history.json` → `{"Saved Media": [...]}`; `Date` is always
  `"YYYY-MM-DD HH:MM:SS UTC"`; `Media Type` casing varies
  (`PHOTO`/`Photo`/`Image`); `Location` has two historical formats and may
  be `N/A`; `Media ID` is absent in some vintages; the download field
  appears as both `Media Download Url` and `Download Link` and is empty in
  exports since ~May 26 2026.
- Media files: `<YYYY-MM-DD>_<UUID>-main.ext` with sibling
  `-overlay.png`; the date prefix is the *export* date, not the capture
  date — never use it for dating when metadata exists.
- Split videos: `…_0.mp4`, `…_1.mp4` segments; multi-Snap = 10s segments,
  newer formats up to 60s.
- Junk: `__MACOSX/`, `._*` AppleDouble, `.DS_Store`.
- Exports arrive as `mydata~*.zip` multi-part sets; only the primary part
  carries `json/` and `html/`.

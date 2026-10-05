// Single source of truth for FAQ content. Rendered visibly on the landing
// page and mirrored into the JSON-LD FAQPage block in index.html —
// src/seo.test.ts fails if the two drift apart.
export const FAQS = [
  {
    q: 'Is Snapkeep free?',
    a: 'Yes — Snapkeep is completely free to use. Non-invasive ads keep it running, and your archive is never uploaded, because it never leaves your device.',
  },
  {
    q: 'How do I export my Snapchat Memories?',
    a: 'In Snapchat, go to Settings → My Data and request an export with Memories included. Snapchat emails you a download link for a ZIP — drop that file into Snapkeep and it does the rest.',
  },
  {
    q: 'Does Snapkeep upload my data anywhere?',
    a: 'No. Your ZIP is opened and processed entirely inside your browser. No file, photo, or video ever leaves your device.',
  },
  {
    q: 'Do you need my Snapchat username or password?',
    a: 'No — never. Snapkeep only reads the ZIP you already downloaded from Snapchat yourself. Any site asking for your Snapchat login to recover Memories is a phishing risk; Snapkeep never asks.',
  },
  {
    q: 'Why are some videos split into multiple files?',
    a: 'Snapchat exports longer videos as several consecutive MP4 parts. Snapkeep detects them, gives every photo and video a clean, dated filename, and organizes everything into year folders so you can find any Memory fast.',
  },
  {
    q: 'Do my photos and videos keep their original dates?',
    a: 'Yes. Snapkeep writes the original capture date back into each file’s metadata (EXIF for photos, MP4 for videos), so Memories sort correctly in Google Photos, Apple Photos, and your camera roll.',
  },
] as const

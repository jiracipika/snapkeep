import { animate, inView } from 'motion'
import { inject } from '@vercel/analytics'
import './guide.css'

// Shared by the static guide pages. The inline <head> script (copied from
// index.html) has already applied the theme class before first paint; this
// module only wires the toggle button, analytics, and gentle scroll reveals.
const KEY = 'snapkeep-theme'

document.getElementById('theme-toggle')?.addEventListener('click', () => {
  const dark = document.documentElement.classList.toggle('dark')
  try {
    localStorage.setItem(KEY, dark ? 'dark' : 'light')
  } catch {
    // Private-mode localStorage throws; the toggle still works for the page.
  }
})

inject()

// Gentle whileInView-style fade-up on guide article blocks. Deliberately
// subtle and SEO-safe: initial hidden styles are applied FROM JS (never in
// CSS), and only to blocks below the initial viewport, so the HTML source
// always contains fully visible content for crawlers and no-JS visitors.
// Honours prefers-reduced-motion (hard rule): if set, nothing is hidden.
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const article = document.querySelector('article')

if (!reducedMotion && article) {
  const blocks = Array.from(article.children).filter((el): el is HTMLElement => {
    if (!(el instanceof HTMLElement)) return false
    // Keep the H1 and "last updated" line static; reveal everything below
    // the fold (section headings, lists, tips, tables, CTA card).
    if (el.tagName === 'H1' || el.classList.contains('updated')) return false
    return el.getBoundingClientRect().top > window.innerHeight
  })

  if (blocks.length > 0) {
    for (const el of blocks) {
      el.style.opacity = '0'
      el.style.transform = 'translateY(14px)'
    }
    inView(
      blocks,
      (el) => {
        animate(
          el,
          { opacity: [0, 1], transform: ['translateY(14px)', 'translateY(0px)'] },
          { type: 'spring', bounce: 0.25, duration: 0.6 },
        )
      },
      { amount: 0.1 },
    )
  }
}

import { inject } from '@vercel/analytics'
import './guide.css'

// Shared by the static guide pages. The inline <head> script (copied from
// index.html) has already applied the theme class before first paint; this
// module only wires the toggle button and analytics.
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

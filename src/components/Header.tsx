import { donateLink, tipLink } from '@/lib/monetization'
import { CardIcon, GithubIcon, GhostLogo, HeartIcon } from './icons'
import { ThemeToggle } from './ThemeToggle'

export function Header({
  theme,
  onToggleTheme,
}: {
  theme: 'light' | 'dark'
  onToggleTheme: () => void
}) {
  const donate = donateLink()
  const tip = tipLink()
  return (
    <header className="sticky top-0 z-40 border-b border-ink-200/60 bg-white/80 backdrop-blur-md dark:border-ink-800/60 dark:bg-ink-950/80">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <a href="/" className="flex items-center gap-2.5" aria-label="Snapkeep home">
          <GhostLogo className="h-8 w-8" />
          <span className="text-lg font-bold tracking-tight">Snapkeep</span>
        </a>
        <div className="flex items-center gap-1">
          {donate && (
            <a
              href={donate}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary !rounded-full !px-4 !py-2 text-sm"
              aria-label="Donate via PayPal"
            >
              <HeartIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Donate</span>
            </a>
          )}
          {tip && (
            <a
              href={tip}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary !rounded-full !px-4 !py-2 text-sm"
              aria-label="Tip with a card via Stripe"
            >
              <CardIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Tip</span>
            </a>
          )}
          <a
            href="https://github.com/jiracipika/snapkeep"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost !rounded-full !p-2.5"
            aria-label="View source on GitHub"
          >
            <GithubIcon className="h-5 w-5" />
          </a>
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        </div>
      </div>
    </header>
  )
}

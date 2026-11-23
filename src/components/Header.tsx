import { donateLink, tipLink } from '@/lib/monetization'
import { LiftLink } from './motionUI'
import { CardIcon, GithubIcon, GhostLogo, HeartIcon } from './icons'
import { ThemeToggle } from './ThemeToggle'

export function Header({
  theme,
  onToggleTheme,
  showLandingLinks,
}: {
  theme: 'light' | 'dark'
  onToggleTheme: () => void
  showLandingLinks: boolean
}) {
  const donate = donateLink()
  const tip = tipLink()
  return (
    <header className="site-header sticky top-0 z-40">
      <div className="mx-auto flex h-[4.25rem] max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <a href="/" className="flex items-center gap-2.5" aria-label="Snapkeep home">
          <GhostLogo className="size-8 shrink-0 sm:size-9" />
          <span className="text-xl font-bold tracking-tight">Snapkeep</span>
        </a>
        <nav aria-label="Main" className="site-nav hidden items-center gap-6 md:flex">
          {showLandingLinks && <a href="#how-it-works">How it works</a>}
          <a href="/guide/how-to-export-snapchat-memories/">Export guide</a>
          {showLandingLinks && <a href="#faq">FAQ</a>}
        </nav>
        <div className="flex items-center gap-1">
          {donate && (
            <LiftLink
              href={donate}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary !min-h-11 !rounded-full !px-3 !py-2 text-sm sm:!px-4"
              aria-label="Donate via PayPal"
            >
              <HeartIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Donate</span>
            </LiftLink>
          )}
          {tip && (
            <LiftLink
              href={tip}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary !min-h-11 !rounded-full !px-4 !py-2 text-sm"
              aria-label="Tip with a card via Stripe"
            >
              <CardIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Tip</span>
            </LiftLink>
          )}
          <LiftLink
            href="https://github.com/jiracipika/snapkeep"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost !rounded-full !p-2.5 sm:!p-3"
            aria-label="View source on GitHub"
          >
            <GithubIcon className="h-5 w-5" />
          </LiftLink>
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        </div>
      </div>
    </header>
  )
}

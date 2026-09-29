import { monetization } from '@/config/monetization'
import { GhostLogo } from './icons'

export function Footer() {
  return (
    <footer className="mt-auto border-t border-ink-200/60 py-8 dark:border-ink-800/60">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 text-center text-sm text-ink-400 dark:text-ink-500 sm:px-6">
        <GhostLogo className="h-6 w-6 opacity-70" />
        <p className="max-w-md text-pretty">
          Your Snapchat archive is processed locally in your browser. Your photos
          and videos are never uploaded.
        </p>
        {monetization.adsenseClient.trim() !== '' && (
          <p className="max-w-md text-pretty text-xs">
            Ads on this page (served by Google AdSense) keep Snapkeep free to
            use — they never see your archive, because it never leaves your
            device.
          </p>
        )}
        <p className="text-xs">
          Not affiliated with Snap Inc. Snapchat is a trademark of Snap Inc.
        </p>
      </div>
    </footer>
  )
}

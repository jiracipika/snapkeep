import { useEffect, useSyncExternalStore, type CSSProperties } from 'react'
import { monetization } from '@/config/monetization'
import { adUnitReady, houseMessage } from '@/lib/monetization'

declare global {
  interface Window {
    adsbygoogle?: object[]
  }
}

// The loader in index.html populates window.adsbygoogle once loaded; every
// <ins> we mount registers itself through that queue.
function pushAdUnit() {
  try {
    ;(window.adsbygoogle = window.adsbygoogle || []).push({})
  } catch {
    // adsbygoogle surfaces its own errors; an absent queue just means the
    // loader hasn't finished loading yet.
  }
}

/** Live media-query read; the server snapshot is only used before hydration. */
function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (notify) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', notify)
      return () => mql.removeEventListener('change', notify)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}

function AdChip() {
  return (
    <span
      aria-hidden
      className="ad-chip absolute right-2 top-2 z-10 rounded bg-white px-1 text-[10px] font-semibold uppercase tracking-wider text-ink-500 dark:bg-ink-950 dark:text-ink-400"
    >
      Ad
    </span>
  )
}

function HouseCard({
  slotKey,
  className,
}: {
  slotKey: string
  className: string
}) {
  return (
    <div
      aria-label="Advertisement"
      className={`relative flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-ink-200 bg-ink-50/60 p-4 text-center dark:border-ink-800 dark:bg-ink-900/40 ${className}`}
    >
      <AdChip />
      <p className="text-xs leading-relaxed text-pretty text-ink-500 dark:text-ink-400">
        {houseMessage(slotKey)}
      </p>
    </div>
  )
}

function AdSlot({
  slotId,
  slotKey,
  format,
  insStyle,
  className,
}: {
  slotId: string
  slotKey: string
  /** AdSense display format hint for the unit. */
  format: 'vertical' | 'horizontal' | 'rectangle' | 'auto'
  /** Inline sizing for fixed-size units; responsive units size to the container. */
  insStyle?: CSSProperties
  className: string
}) {
  const ready = adUnitReady(monetization.adsenseClient, slotId)

  useEffect(() => {
    if (ready) pushAdUnit()
  }, [ready, slotId])

  if (!ready) return <HouseCard slotKey={slotKey} className={className} />

  return (
    <div aria-label="Advertisement" className={`ad-unit relative ${className}`}>
      <AdChip />
      <ins
        className="adsbygoogle block"
        style={insStyle ?? { display: 'block' }}
        data-ad-client={monetization.adsenseClient}
        data-ad-slot={slotId}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </div>
  )
}

/**
 * Side rails: 160px wide skyscrapers, shown only from `xl` (1280px) up so the
 * middle column always keeps more than a 4:3 width-to-height share of the
 * viewport. Single slot per rail — a second unit during processing pushed the
 * progress card below the fold (ads never intercept the core flow).
 *
 * The unit is only mounted while the rail is visible. AdSense refuses a unit
 * whose box has no width ("No slot size for availableWidth=0") and that error
 * stops it working through the rest of the queue, so a hidden rail used to
 * take the bottom ad down with it on every screen narrower than `xl`.
 */
export function AdRail({ side }: { side: 'left' | 'right' }) {
  const slots = monetization.adSlots.rail
  const wide = useMediaQuery('(min-width: 1280px)')
  return (
    <aside
      aria-label="Advertisements"
      className="hidden w-40 shrink-0 flex-col gap-6 py-12 xl:flex"
    >
      {wide && (
        <AdSlot
          slotId={slots[0] ?? ''}
          slotKey={`${side}-rail-1`}
          format="vertical"
          insStyle={{ display: 'inline-block', width: 160, height: 600 }}
          className="h-[600px] w-40"
        />
      )}
    </aside>
  )
}

/**
 * Leaderboard band at the very bottom, above the footer.
 *
 * The unit must own its full width: as a centred flex item it shrank to zero,
 * and AdSense skipped it — this ad never rendered. The band keeps no height of
 * its own, so an unfilled unit leaves no empty box behind.
 */
export function BottomAd() {
  const slotId = monetization.adSlots.bottom
  const ready = adUnitReady(monetization.adsenseClient, slotId)
  return (
    <div className="ad-band mx-auto w-full max-w-4xl px-4 pb-2 sm:px-6">
      <AdSlot
        slotId={slotId}
        slotKey="bottom"
        format="horizontal"
        insStyle={{ display: 'block', width: '100%' }}
        className={ready ? 'w-full' : 'min-h-[90px] w-full'}
      />
      <p className="ad-caption mt-2 text-center text-xs text-ink-500 dark:text-ink-400">
        Ads keep Snapkeep running (and free) :) Your archive still never leaves
        your device.
      </p>
    </div>
  )
}

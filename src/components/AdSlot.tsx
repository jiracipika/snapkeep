import { useEffect, type CSSProperties } from 'react'
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

function AdChip() {
  return (
    <span
      aria-hidden
      className="absolute right-2 top-2 z-10 rounded bg-white/70 px-1 text-[10px] font-medium uppercase tracking-wider text-ink-400 dark:bg-ink-950/70 dark:text-ink-600"
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
      <p className="text-xs leading-relaxed text-pretty text-ink-400 dark:text-ink-500">
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
    <div aria-label="Advertisement" className={`relative ${className}`}>
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
 * viewport. `busy` adds the second rail unit while an archive is processing.
 */
export function AdRail({ side, busy }: { side: 'left' | 'right'; busy: boolean }) {
  const slots = monetization.adSlots.rail
  return (
    <aside
      aria-label="Advertisements"
      className="hidden w-40 shrink-0 flex-col gap-6 py-12 xl:flex"
    >
      <AdSlot
        slotId={slots[0] ?? ''}
        slotKey={`${side}-rail-1`}
        format="vertical"
        insStyle={{ display: 'inline-block', width: 160, height: 600 }}
        className="h-[600px] w-40"
      />
      {busy && slots[1] !== undefined && (
        <AdSlot
          slotId={slots[1]}
          slotKey={`${side}-rail-2`}
          format="vertical"
          insStyle={{ display: 'inline-block', width: 160, height: 600 }}
          className="h-[600px] w-40"
        />
      )}
    </aside>
  )
}

/** Leaderboard band at the very bottom, above the footer. */
export function BottomAd() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-2 sm:px-6">
      <AdSlot
        slotId={monetization.adSlots.bottom}
        slotKey="bottom"
        format="horizontal"
        className="flex min-h-[90px] w-full items-center justify-center"
      />
      <p className="mt-2 text-center text-xs text-ink-400 dark:text-ink-600">
        Ads keep Snapkeep running (and free) :) Your archive still never leaves
        your device.
      </p>
    </div>
  )
}

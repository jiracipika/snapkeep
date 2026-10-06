import { monetization } from '@/config/monetization'

/** A display-ad unit can only render when both the publisher and slot IDs exist. */
export function adUnitReady(client: string, slotId: string): boolean {
  return client.trim() !== '' && slotId.trim() !== ''
}

/**
 * PayPal donate URL for the header button. Returns null unless the value is
 * an https paypal.com link, so a bad paste never ships as a dead button.
 */
export function donateLink(url: string = monetization.paypalDonateUrl): string | null {
  const u = url.trim()
  return /^https:\/\/(www\.)?paypal\.com\//.test(u) ? u : null
}

/**
 * Stripe Payment Link for card tips. Returns null unless the value is an
 * https buy.stripe.com payment-link URL (path-only, no query), so a bad
 * paste never ships as a dead button.
 */
export function tipLink(url: string = monetization.stripeTipUrl): string | null {
  const u = url.trim()
  return /^https:\/\/buy\.stripe\.com\/[A-Za-z0-9_]+$/.test(u) ? u : null
}

const HOUSE_MESSAGES = [
  'Ads keep Snapkeep running — and your Memories stay on your device.',
  'Processed locally, always. The only thing reaching out from this page is the odd ad.',
  'No accounts, no uploads. These side notes keep the lights on.',
  'Snapkeep is free for everyone — ads pay for the bandwidth.',
] as const

/** Deterministic per-slot house-ad message, so slots don't flicker between renders. */
export function houseMessage(slotKey: string): string {
  let hash = 0
  for (let i = 0; i < slotKey.length; i++) {
    hash = (hash * 31 + slotKey.charCodeAt(i)) | 0
  }
  return HOUSE_MESSAGES[Math.abs(hash) % HOUSE_MESSAGES.length]
}

/** A display-ad unit can only render when both the publisher and slot IDs exist. */
export function adUnitReady(client: string, slotId: string): boolean {
  return client.trim() !== '' && slotId.trim() !== ''
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

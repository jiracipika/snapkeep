import { describe, expect, it } from 'vitest'
import { adUnitReady, donateLink, houseMessage, tipLink } from './monetization'
import { monetization } from '@/config/monetization'

describe('adUnitReady', () => {
  it('needs both a publisher and a slot id', () => {
    expect(adUnitReady('ca-pub-123', '456')).toBe(true)
    expect(adUnitReady('', '456')).toBe(false)
    expect(adUnitReady('ca-pub-123', '')).toBe(false)
    expect(adUnitReady('  ', '456')).toBe(false)
    expect(adUnitReady('ca-pub-123', '   ')).toBe(false)
  })
})

describe('donateLink', () => {
  it('accepts https paypal.com links', () => {
    const url =
      'https://www.paypal.com/donate/?business=9RM6LCXG5E6JC&currency_code=CAD'
    expect(donateLink(url)).toBe(url)
    expect(donateLink('https://paypal.com/donate/?business=X')).toBe(
      'https://paypal.com/donate/?business=X',
    )
  })

  it('rejects non-paypal or non-https values so a bad paste never ships', () => {
    expect(donateLink('http://paypal.com/donate')).toBeNull()
    expect(donateLink('https://evil.example/donate')).toBeNull()
    expect(donateLink('')).toBeNull()
    expect(donateLink('   ')).toBeNull()
  })
})

describe('tipLink', () => {
  it('accepts live and test buy.stripe.com payment links', () => {
    const live = 'https://buy.stripe.com/9AQ6oEgO12ab3cD4ef'
    expect(tipLink(live)).toBe(live)
    const test = 'https://buy.stripe.com/test_9AQ6oEgO12ab'
    expect(tipLink(test)).toBe(test)
  })

  it('rejects empty, non-https, off-domain, or smuggled values so a bad paste never ships', () => {
    expect(tipLink('')).toBeNull()
    expect(tipLink('   ')).toBeNull()
    expect(tipLink('http://buy.stripe.com/abc')).toBeNull()
    expect(tipLink('https://evil.com/buy.stripe.com/abc')).toBeNull()
    expect(tipLink('https://buy.stripe.com.evil.com/abc')).toBeNull()
    expect(tipLink('https://stripe.com/abc')).toBeNull()
    expect(tipLink('https://buy.stripe.com/abc?query=1')).toBeNull()
  })

  it('config exposes the stripeTipUrl key (empty until a Payment Link exists)', () => {
    expect(monetization).toHaveProperty('stripeTipUrl')
  })
})

describe('houseMessage', () => {
  it('is deterministic for a given slot', () => {
    expect(houseMessage('left-rail-1')).toBe(houseMessage('left-rail-1'))
  })

  it('spreads messages across slots', () => {
    const slots = ['left-rail-1', 'left-rail-2', 'right-rail-1', 'right-rail-2', 'bottom']
    const picked = new Set(slots.map(houseMessage))
    expect(picked.size).toBeGreaterThan(1)
  })

  it('always returns a non-empty message', () => {
    for (const key of ['', 'a', 'bottom', 'zzzz', 'rail-extra-while-busy']) {
      expect(houseMessage(key).length).toBeGreaterThan(0)
    }
  })
})

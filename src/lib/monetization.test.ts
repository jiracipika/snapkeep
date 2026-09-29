import { describe, expect, it } from 'vitest'
import { adUnitReady, donateLink, houseMessage } from './monetization'

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

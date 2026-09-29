// Monetization wiring. Nothing here is a secret: AdSense publisher IDs and
// Stripe payment links are public by design.
export const monetization = {
  // Google AdSense publisher — loader script lives in index.html <head>.
  adsenseClient: 'ca-pub-4128325832827761',

  // Display-ad unit IDs from AdSense → Ads → By ad unit. An empty ID falls
  // back to a friendly house card instead of an (illegal) empty ad unit.
  adSlots: {
    // 160×600 wide skyscrapers for the side rails; the second one only
    // renders while an archive is being processed.
    rail: ['', ''],
    // Responsive horizontal (leaderboard) band at the very bottom.
    bottom: '',
  },

  // PayPal donate button in the header ("Buy me a coffee").
  paypalDonateUrl:
    'https://www.paypal.com/donate/?business=9RM6LCXG5E6JC&no_recurring=0&item_name=Buy+me+a+coffee+%3A%29&currency_code=CAD',
}

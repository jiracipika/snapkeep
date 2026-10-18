/**
 * Shared Motion transition presets ("cool but subtle").
 * Springs only; transform/opacity only. <MotionConfig reducedMotion="user">
 * in main.tsx already disables transform motion for users who prefer
 * reduced motion, so these are safe app-wide.
 * Kept component-free so react-fast-refresh stays happy.
 */

/** Gentle entrance spring (house default: 16–24px rise + fade). */
export const spring = { type: 'spring', bounce: 0.3, duration: 0.6 } as const

/** Snappier spring for hover/press gestures. */
export const gestureSpring = { type: 'spring', stiffness: 400, damping: 25 } as const

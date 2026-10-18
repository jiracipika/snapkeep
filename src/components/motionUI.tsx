import { motion } from 'motion/react'
import type { HTMLMotionProps } from 'motion/react'
import { gestureSpring } from './motionPresets'

/**
 * Shared Motion primitives: hover lift + press spring for buttons/links.
 * Pass-through props; className preserved. reducedMotion is handled
 * globally by <MotionConfig> in main.tsx.
 */

/** Button with hover lift + press spring. */
export function LiftButton(props: HTMLMotionProps<'button'>) {
  return (
    <motion.button
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.97 }}
      transition={gestureSpring}
      {...props}
    />
  )
}

/** Link with hover lift + press spring. */
export function LiftLink(props: HTMLMotionProps<'a'>) {
  return (
    <motion.a
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.97 }}
      transition={gestureSpring}
      {...props}
    />
  )
}

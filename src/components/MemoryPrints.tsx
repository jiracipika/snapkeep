import { motion, useMotionValue, useReducedMotion, useSpring, useTransform, type MotionValue } from 'motion/react'
import type { PointerEvent } from 'react'

/**
 * Three prints on the desk: the page's one piece of real imagery. They are
 * dealt in on arrival, and under a mouse each answers the pointer by its depth
 * — the centre print travels furthest — so the fan reads as objects lying on a
 * surface rather than one flat picture.
 *
 * Decorative (aria-hidden), and never the largest paint on the page, so the
 * entrance costs LCP nothing.
 */

const PRINTS = [
  { rotate: -8, depth: 1 }, // left, further back
  { rotate: 4, depth: 1.7, lift: -4 }, // centre, nearest
  { rotate: 10, depth: 0.8 }, // right
] as const

function Print({
  index,
  rotate,
  depth,
  lift = 0,
  sx,
  sy,
  enter,
}: {
  index: number
  rotate: number
  depth: number
  lift?: number
  sx: MotionValue<number>
  sy: MotionValue<number>
  enter: boolean
}) {
  const x = useTransform(sx, (v) => v * 11 * depth)
  const y = useTransform(sy, (v) => v * 8 * depth)

  return (
    <motion.div
      className="memory-print"
      style={{ rotate, y: lift } as never}
      initial={enter ? { opacity: 0, scale: 0.9 } : false}
      animate={{ opacity: 1, scale: 1 }}
      // Picking a print up: it comes forward and straightens a little.
      whileHover={enter ? { scale: 1.06, y: lift - 5, rotate: rotate * 0.6 } : undefined}
      transition={{ type: 'spring', stiffness: 140, damping: 16, delay: 0.16 + index * 0.09 }}
    >
      <motion.span className="memory-print-shift" style={{ x, y }}>
        <span />
      </motion.span>
    </motion.div>
  )
}

export function MemoryPrints() {
  const reduce = useReducedMotion()
  // Pointer position across the group, -1..1 on each axis, followed through springs.
  const px = useMotionValue(0)
  const py = useMotionValue(0)
  const sx = useSpring(px, { stiffness: 70, damping: 18, mass: 0.6 })
  const sy = useSpring(py, { stiffness: 70, damping: 18, mass: 0.6 })

  const track = (event: PointerEvent<HTMLDivElement>) => {
    // A finger dragging the page is not a pointer hovering the prints.
    if (reduce || event.pointerType !== 'mouse') return
    const box = event.currentTarget.getBoundingClientRect()
    px.set(((event.clientX - box.left) / box.width - 0.5) * 2)
    py.set(((event.clientY - box.top) / box.height - 0.5) * 2)
  }
  const reset = () => {
    px.set(0)
    py.set(0)
  }

  return (
    <div className="memory-prints" aria-hidden="true" onPointerMove={track} onPointerLeave={reset}>
      {PRINTS.map((print, index) => (
        <Print
          key={index}
          index={index}
          rotate={print.rotate}
          depth={print.depth}
          lift={'lift' in print ? print.lift : 0}
          sx={reduce ? px : sx}
          sy={reduce ? py : sy}
          enter={!reduce}
        />
      ))}
    </div>
  )
}

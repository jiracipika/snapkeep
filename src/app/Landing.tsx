import { motion } from 'motion/react'
import { DropZone } from '@/components/DropZone'
import { LockIcon } from '@/components/icons'
import { gestureSpring, spring } from '@/components/motionPresets'
import { ModeSelector, type Mode } from '@/components/ModeSelector'
import { FAQS } from '@/config/seo'

const STEPS = [
  {
    title: 'Request your data',
    body: 'In Snapchat, go to Settings → My Data and request an export with Memories included.',
  },
  {
    title: 'Drop the ZIP here',
    body: 'Snapkeep reads the archive right in your browser — nothing is uploaded anywhere.',
  },
  {
    title: 'Download your Memories',
    body: 'Get a clean ZIP with sensible filenames, sorted by year, ready for your camera roll.',
  },
]

// Hero entrance: staggered spring rise-and-fade. Variants propagate to the
// motion children below; MotionConfig handles prefers-reduced-motion.
const heroGroup = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
}
const chipGroup = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
}
const heroItem = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: spring },
}

// Scroll reveal for feature/step blocks: fade-up once, then a gentle hover lift.
const reveal = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0, transition: { ...spring, delay } },
  viewport: { once: true },
  whileHover: { y: -4 },
  transition: gestureSpring,
})

export function Landing({
  mode,
  onModeChange,
  onFiles,
}: {
  mode: Mode
  onModeChange: (mode: Mode) => void
  onFiles: (files: File[]) => void
}) {
  return (
    <main id="main" className="relative mx-auto w-full max-w-3xl flex-1 px-4 pb-20 pt-12 sm:px-6 sm:pt-16">
      {/* soft hero glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 mx-auto h-80 max-w-2xl bg-[radial-gradient(ellipse_at_top,rgba(242,213,0,0.18),transparent_65%)] blur-2xl"
      />

      <motion.section variants={heroGroup} initial="hidden" animate="show" className="text-center">
        <motion.h1
          variants={heroItem}
          className="text-balance text-4xl font-bold tracking-tight sm:text-5xl"
        >
          Export your{' '}
          <span className="text-brand-700 decoration-brand-300/70 decoration-8 underline-offset-8 underline dark:text-brand-300 dark:decoration-brand-500/40">
            Snapchat Memories
          </span>
        </motion.h1>
        <motion.p
          variants={heroItem}
          className="mx-auto mt-4 max-w-xl text-pretty text-lg text-ink-500 dark:text-ink-400"
        >
          Turn your Snapchat data export into normal photos and videos you can
          actually keep.
        </motion.p>
        <motion.div
          variants={chipGroup}
          className="mt-6 flex flex-wrap items-center justify-center gap-2"
        >
          {['100% free', 'No sign-up', 'No uploads', 'Open source'].map((chip) => (
            <motion.span
              key={chip}
              variants={heroItem}
              className="rounded-full border border-ink-200 bg-ink-50 px-3 py-1 text-xs font-medium text-ink-600 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300"
            >
              {chip}
            </motion.span>
          ))}
        </motion.div>
      </motion.section>

      <motion.section
        className="mt-10"
        aria-label="Upload your Snapchat export"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...spring, delay: 0.35 }}
      >
        <DropZone onFiles={onFiles} />
        <p className="mt-4 flex items-center justify-center gap-2 text-center text-sm text-ink-500 dark:text-ink-400">
          <LockIcon className="h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400" />
          <span>
            <strong className="font-semibold text-ink-700 dark:text-ink-200">
              Processed locally on your device.
            </strong>{' '}
            Nothing is uploaded.
          </span>
        </p>
      </motion.section>

      <motion.section
        className="mt-12"
        aria-label="Choose a mode"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...spring, delay: 0.45 }}
      >
        <h2 className="sr-only">Choose a mode</h2>
        <div className="flex justify-center">
          <ModeSelector mode={mode} onChange={onModeChange} />
        </div>
      </motion.section>

      <section className="mt-16" aria-label="How it works">
        <h2 className="text-center text-2xl font-bold tracking-tight">How it works</h2>
        <ol className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <motion.li key={step.title} className="card p-5" {...reveal(i * 0.08)}>
              <span
                aria-hidden
                className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-800 dark:bg-brand-900/40 dark:text-brand-300"
              >
                {i + 1}
              </span>
              <h3 className="mt-3 font-semibold">{step.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-ink-500 dark:text-ink-400">
                {step.body}
              </p>
            </motion.li>
          ))}
        </ol>
      </section>

      <motion.section
        className="mt-16 max-w-2xl text-center"
        aria-label="What is Snapkeep"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={spring}
      >
        <h2 className="text-2xl font-bold tracking-tight">What is Snapkeep?</h2>
        <p className="mt-4 text-pretty leading-relaxed text-ink-500 dark:text-ink-400">
          Snapkeep is a free online tool that opens the ZIP Snapchat sends when you
          request your data (the &ldquo;My Data&rdquo; export) and turns it into normal, dated
          photos and videos — ready for your camera roll, Google Photos, or Apple
          Photos. Everything runs locally in your browser: no uploads, no sign-up,
          no watermarks, and your original archive is never modified.
        </p>
      </motion.section>

      <section className="mt-16" aria-label="Frequently asked questions">
        <h2 className="text-center text-2xl font-bold tracking-tight">
          Frequently asked questions
        </h2>
        <div className="mx-auto mt-6 grid max-w-2xl gap-4">
          {FAQS.map((faq) => (
            <motion.div key={faq.q} className="card p-5" {...reveal()}>
              <h3 className="font-semibold">{faq.q}</h3>
              <p className="mt-1 text-sm leading-relaxed text-ink-500 dark:text-ink-400">{faq.a}</p>
            </motion.div>
          ))}
        </div>
      </section>
    </main>
  )
}

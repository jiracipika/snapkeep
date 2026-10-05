import { DropZone } from '@/components/DropZone'
import { LockIcon } from '@/components/icons'
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

      <section className="text-center">
        <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl">
          Organize your{' '}
          <span className="bg-gradient-to-r from-brand-600 to-brand-400 bg-clip-text text-transparent dark:from-brand-300 dark:to-brand-500">
            Snapchat Memories
          </span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-pretty text-lg text-ink-500 dark:text-ink-400">
          Turn your Snapchat data export into normal photos and videos you can
          actually keep.
        </p>
      </section>

      <section className="mt-10" aria-label="Upload your Snapchat export">
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
      </section>

      <section className="mt-12">
        <h2 className="sr-only">Choose a mode</h2>
        <div className="flex justify-center">
          <ModeSelector mode={mode} onChange={onModeChange} />
        </div>
      </section>

      <section className="mt-16" aria-label="How it works">
        <h2 className="text-center text-sm font-semibold uppercase tracking-widest text-ink-400 dark:text-ink-500">
          How it works
        </h2>
        <ol className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className="card p-5">
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
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-16" aria-label="Frequently asked questions">
        <h2 className="text-center text-sm font-semibold uppercase tracking-widest text-ink-400 dark:text-ink-500">
          Frequently asked questions
        </h2>
        <div className="mx-auto mt-6 grid max-w-2xl gap-4">
          {FAQS.map((faq) => (
            <div key={faq.q} className="card p-5">
              <h3 className="font-semibold">{faq.q}</h3>
              <p className="mt-1 text-sm leading-relaxed text-ink-500 dark:text-ink-400">{faq.a}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}

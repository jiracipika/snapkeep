import { DropZone } from '@/components/DropZone'
import { ArchiveIcon, DownloadIcon, LockIcon, PhotoIcon, UploadIcon } from '@/components/icons'
import { ModeSelector, type Mode } from '@/components/ModeSelector'
import { FAQS } from '@/config/seo'

const exportGuide = '/guide/how-to-export-snapchat-memories/'

const steps = [
  {
    icon: ArchiveIcon,
    title: 'Request your data',
    body: 'Open Settings in Snapchat, select My Data, and include Memories in your export.',
  },
  {
    icon: UploadIcon,
    title: 'Open your ZIP',
    body: 'Download the ZIP from Snapchat and choose it in Snapkeep. You can select multiple parts together.',
  },
  {
    icon: DownloadIcon,
    title: 'Save your Memories',
    body: 'Download a fresh ZIP with dated photos and videos organized into folders by year.',
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
    <main id="main" className="landing mx-auto w-full max-w-6xl flex-1">
      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-intro">
          <h1 id="landing-title">
            Export your Snapchat <em>Memories.</em>
          </h1>
          <p className="landing-summary">
            Turn your Snapchat My Data export into dated photos and videos you can
            keep anywhere.
          </p>
          <a className="landing-guide" href={exportGuide}>How to get your Snapchat ZIP</a>

          <div className="memory-prints" aria-hidden="true">
            <div className="memory-print"><span /></div>
            <div className="memory-print"><span /></div>
            <div className="memory-print"><span /></div>
          </div>
        </div>

        <section className="import-card" aria-labelledby="import-title">
          <div className="import-title">
            <span className="import-mark"><ArchiveIcon /></span>
            <div>
              <h2 id="import-title">Open your archive</h2>
              <p>Free to use · No account needed</p>
            </div>
          </div>
          {/* The action comes first; the mode is an option, and Easy is the
              default, so nothing has to be decided before picking a file. */}
          <DropZone onFiles={onFiles} />
          <p className="import-privacy">
            <LockIcon className="size-4 shrink-0" />
            Your files stay on this device.
          </p>
          <ModeSelector mode={mode} onChange={onModeChange} />
        </section>
      </section>

      <section id="how-it-works" className="landing-steps" aria-labelledby="steps-title">
        <h2 id="steps-title">How it works</h2>
        <ol>
          {steps.map(({ icon: Icon, title, body }) => (
            <li key={title}>
              <Icon className="step-icon" />
              <h3>{title}</h3>
              <p>{body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="faq" className="landing-faq" aria-labelledby="faq-title">
        <div>
          <h2 id="faq-title">Frequently asked questions</h2>
          <p>
            Snapkeep prepares your photos and videos for your camera roll, Google Photos, or
            Apple Photos. Your original archive stays intact.
          </p>
          <a href={exportGuide} className="landing-guide">
            <PhotoIcon className="size-4" /> Read the export guide
          </a>
        </div>
        <div className="faq-list">
          {FAQS.map((faq) => (
            <details key={faq.q}>
              <summary>{faq.q}</summary>
              <p>{faq.a}</p>
            </details>
          ))}
        </div>
      </section>
    </main>
  )
}

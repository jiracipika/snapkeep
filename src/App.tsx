import { useState } from 'react'
import { Landing } from '@/app/Landing'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import type { Mode } from '@/components/ModeSelector'
import { useTheme } from '@/components/ThemeToggle'

type Screen = 'landing' | 'processing' | 'result' | 'advanced'

export default function App() {
  const { theme, toggle } = useTheme()
  const [mode, setMode] = useState<Mode>('easy')
  const [screen, setScreen] = useState<Screen>('landing')
  const [files, setFiles] = useState<File[]>([])

  return (
    <div className="flex min-h-svh flex-col">
      <Header theme={theme} onToggleTheme={toggle} />

      {screen === 'landing' && (
        <Landing
          mode={mode}
          onModeChange={setMode}
          onFile={(file) => {
            setFiles([file])
            setScreen('processing')
          }}
        />
      )}

      {screen === 'processing' && (
        <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="text-lg font-semibold">Reading your archive…</p>
          <p className="text-sm text-ink-500">
            {files.length > 0 ? files[0].name : ''} — processing lands in the next
            build.
          </p>
        </main>
      )}

      <Footer />
    </div>
  )
}

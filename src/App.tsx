import { useState } from 'react'
import { Landing } from '@/app/Landing'
import { ProcessingScreen } from '@/app/ProcessingScreen'
import { ResultScreen } from '@/app/ResultScreen'
import { AdvancedScreen } from '@/app/advanced/AdvancedScreen'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import type { Mode } from '@/components/ModeSelector'
import { useTheme } from '@/components/useTheme'
import { ArchiveSession, type ScanStage } from '@/lib/snapchat/session'

type Screen = 'landing' | 'processing' | 'result' | 'advanced'

export default function App() {
  const { theme, toggle } = useTheme()
  const [mode, setMode] = useState<Mode>('easy')
  const [screen, setScreen] = useState<Screen>('landing')
  const [scanStage, setScanStage] = useState<ScanStage>('opening')
  const [scanError, setScanError] = useState<string | null>(null)
  const [fileCount, setFileCount] = useState(0)
  const [session, setSession] = useState<ArchiveSession | null>(null)

  const startScan = async (picked: File[]) => {
    const zips = picked.filter((f) => /\.zip$/i.test(f.name) || f.type.includes('zip'))
    if (zips.length === 0) {
      setFileCount(picked.length)
      setScanError('That doesn’t look like a ZIP archive. Snapchat exports download as .zip files.')
      setScreen('processing')
      return
    }
    setFileCount(zips.length)
    setScanError(null)
    setScanStage('opening')
    setScreen('processing')
    try {
      const created = await ArchiveSession.create(zips, (p) => setScanStage(p.stage))
      setSession(created)
      setScreen(mode === 'advanced' ? 'advanced' : 'result')
    } catch (err) {
      setSession(null)
      setScanError(
        err instanceof Error
          ? err.message
          : 'This file could not be read as a ZIP archive.',
      )
    }
  }

  const restart = () => {
    setSession(null)
    setScanError(null)
    setScreen('landing')
  }

  return (
    <div className="flex min-h-svh flex-col">
      <Header theme={theme} onToggleTheme={toggle} />

      {screen === 'landing' && (
        <Landing mode={mode} onModeChange={setMode} onFiles={startScan} />
      )}

      {screen === 'processing' && (
        <ProcessingScreen
          stage={scanError ? 'error' : scanStage}
          fileCount={fileCount}
          error={scanError}
          onCancel={restart}
        />
      )}

      {screen === 'result' && session && (
        <ResultScreen
          session={session}
          onAdvanced={() => setScreen('advanced')}
          onRestart={restart}
        />
      )}

      {screen === 'advanced' && session && (
        <AdvancedScreen
          session={session}
          onBack={() => setScreen('result')}
          onRestart={restart}
        />
      )}

      <Footer />
    </div>
  )
}

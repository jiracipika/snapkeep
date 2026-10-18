import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MotionConfig } from 'motion/react'
import { inject } from '@vercel/analytics'
import './index.css'
import App from './App.tsx'

inject()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* reducedMotion="user": honours prefers-reduced-motion — transforms
        resolve instantly, opacity still fades. Hard rule for all Motion use. */}
    <MotionConfig reducedMotion="user">
      <App />
    </MotionConfig>
  </StrictMode>,
)

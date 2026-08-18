import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { applyTheme } from '@/stores/useUIStore'
import './index.css'

// Apply the stored theme before the first paint so there is no light flash.
try {
  const stored = localStorage.getItem('tiesheet.ui.v1')
  const theme = stored ? (JSON.parse(stored)?.state?.theme ?? 'dark') : 'dark'
  applyTheme(theme)
} catch {
  applyTheme('dark')
}

const container = document.getElementById('root')
if (!container) throw new Error('Root element #root is missing from index.html')

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

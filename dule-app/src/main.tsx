import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import { applyTheme, StoreProvider, THEME_KEY } from './store'
import '@fontsource-variable/nunito'
import './styles.css'

registerSW({ immediate: true })

// Set the saved theme before first paint to avoid a flash (light is the default).
let savedTheme: string | null = null
try {
  savedTheme = localStorage.getItem(THEME_KEY)
} catch {}
applyTheme(savedTheme === 'escuro' ? 'escuro' : 'claro')

// Keep the screen on while the app is open (supported on most modern phones).
const keepAwake = () => {
  if (document.visibilityState === 'visible') navigator.wakeLock?.request('screen').catch(() => {})
}
keepAwake()
document.addEventListener('visibilitychange', keepAwake)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <App />
    </StoreProvider>
  </StrictMode>,
)

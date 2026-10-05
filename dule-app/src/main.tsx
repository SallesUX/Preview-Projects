import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import { StoreProvider } from './store'
import './styles.css'

registerSW({ immediate: true })

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

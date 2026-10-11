import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import { applyTheme, StoreProvider, THEME_KEY } from './store'
import { sair, sessaoAtual, type Sessao } from './auth'
import { Login } from './components/Login'
import { Admin } from './components/Admin'
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

function Root() {
  const [sessao, setSessao] = useState<Sessao | null>(sessaoAtual)
  const logout = () => {
    sair()
    setSessao(null)
  }
  if (!sessao) return <Login onLogin={setSessao} />
  if (sessao.tipo === 'admin') return <Admin onLogout={logout} />
  return (
    // key: remount the store when another account logs in
    <StoreProvider key={sessao.id} usuario={sessao} onLogout={logout}>
      <App />
    </StoreProvider>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)

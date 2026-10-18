import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import { applyTheme, StoreProvider, THEME_KEY } from './store'
import { sair, sessaoAtual, type Sessao } from './auth'
import * as sync from './sync'
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
  const [sessao, setSessao] = useState<Sessao | null>(() => {
    const s = sessaoAtual()
    // set before the first render so the very first writes are already queued for the cloud
    sync.setActiveUser(s?.id ?? null)
    return s
  })
  useEffect(() => {
    if (!sessao) return
    sync.start(sessao.id, { admin: sessao.tipo === 'admin' })
    return () => sync.stop()
  }, [sessao])
  const login = (s: Sessao) => {
    sync.setActiveUser(s.id)
    setSessao(s)
  }
  const logout = () => {
    sync.stop()
    void sair()
    setSessao(null)
  }
  if (!sessao) return <Login onLogin={login} />
  if (sessao.tipo === 'admin') return <Admin onLogout={logout} nuvem={sessao.nuvem} />
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

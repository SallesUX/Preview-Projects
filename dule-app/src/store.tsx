import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { db, requestPersistence, uid } from './db'
import { DEFAULT_SHORTCUTS } from './content'
import type { DuleEvent, Parto, PhaseId, Settings, Tema } from './types'

interface Store {
  ready: boolean
  settings: Settings
  parto: Parto
  partos: Parto[]
  events: DuleEvent[]
  /** contraction in progress (start time), kept in memory + localStorage */
  running: number | null
  now: number
  addEvent: (e: Omit<DuleEvent, 'id' | 'partoId'> & { id?: string }) => Promise<DuleEvent>
  updateEvent: (e: DuleEvent) => Promise<void>
  removeEvent: (e: DuleEvent) => Promise<void>
  startContraction: () => void
  stopContraction: () => Promise<DuleEvent | null>
  cancelContraction: () => void
  setSettings: (s: Settings) => Promise<void>
  setFaseManual: (f: PhaseId | null) => Promise<void>
  newParto: (nome: string) => Promise<void>
  switchParto: (id: string) => Promise<void>
  reload: () => Promise<void>
}

const Ctx = createContext<Store | null>(null)
export const useStore = () => {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore outside provider')
  return s
}

const RUN_KEY = 'dule.running'
export const THEME_KEY = 'dule.tema'

/** Apply the theme to <html> and remember it so main.tsx can set it before first paint. */
export function applyTheme(tema: Tema | undefined) {
  const dark = tema === 'escuro'
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#1b151d' : '#fbf1f4')
  try {
    localStorage.setItem(THEME_KEY, dark ? 'escuro' : 'claro')
  } catch {}
}

const defaultSettings = (partoId: string): Settings => ({
  partoAtivoId: partoId,
  alerta: { intervaloMin: 5, duracaoSeg: 60, janelaMin: 60 },
  lembretes: { dorAtivo: true, dorMin: 30, dorContracoes: 5, humorAtivo: true, humorMin: 60 },
  atalhos: DEFAULT_SHORTCUTS,
})

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [settings, setSettingsState] = useState<Settings | null>(null)
  const [partos, setPartos] = useState<Parto[]>([])
  const [events, setEvents] = useState<DuleEvent[]>([])
  const [running, setRunning] = useState<number | null>(() => {
    const v = localStorage.getItem(RUN_KEY)
    return v ? Number(v) : null
  })
  const [now, setNow] = useState(Date.now())

  // ticking clock: fast while a contraction runs, slower otherwise
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), running ? 250 : 15_000)
    return () => clearInterval(t)
  }, [running])

  const load = useCallback(async () => {
    let ps = await db.partos()
    let st = await db.getSettings()
    if (ps.length === 0) {
      const p: Parto = { id: uid(), nome: 'Nosso parto', criadoEm: Date.now(), faseManual: null }
      await db.putParto(p)
      ps = [p]
    }
    if (!st) {
      st = defaultSettings(ps[0].id)
      await db.putSettings(st)
    }
    if (!ps.find((p) => p.id === st!.partoAtivoId)) st = { ...st, partoAtivoId: ps[0].id }
    setPartos(ps.sort((a, b) => a.criadoEm - b.criadoEm))
    setSettingsState(st)
    setEvents(await db.eventsByParto(st.partoAtivoId))
    setReady(true)
  }, [])

  useEffect(() => {
    load()
    requestPersistence()
  }, [load])

  const parto = useMemo(
    () => partos.find((p) => p.id === settings?.partoAtivoId) ?? partos[0],
    [partos, settings],
  )

  const addEvent: Store['addEvent'] = async (e) => {
    const ev: DuleEvent = { ...e, id: e.id ?? uid(), partoId: parto.id }
    await db.putEvent(ev)
    setEvents((xs) => [...xs, ev].sort((a, b) => a.inicio - b.inicio))
    return ev
  }
  const updateEvent = async (e: DuleEvent) => {
    await db.putEvent(e)
    setEvents((xs) => xs.map((x) => (x.id === e.id ? e : x)).sort((a, b) => a.inicio - b.inicio))
  }
  const removeEvent = async (e: DuleEvent) => {
    await db.deleteEvent(e.id)
    if (e.audioId) await db.deleteAudio(e.audioId)
    setEvents((xs) => xs.filter((x) => x.id !== e.id))
  }

  const startContraction = () => {
    const t = Date.now()
    localStorage.setItem(RUN_KEY, String(t))
    setRunning(t)
    navigator.vibrate?.(30)
  }
  const cancelContraction = () => {
    localStorage.removeItem(RUN_KEY)
    setRunning(null)
  }
  const stopContraction = async () => {
    if (!running) return null
    const ev = await addEvent({ tipo: 'contracao', inicio: running, fim: Date.now() })
    cancelContraction()
    navigator.vibrate?.([20, 40, 20])
    return ev
  }

  useEffect(() => {
    if (settings) applyTheme(settings.tema)
  }, [settings?.tema])

  const setSettings = async (s: Settings) => {
    await db.putSettings(s)
    setSettingsState(s)
  }
  const setFaseManual = async (f: PhaseId | null) => {
    const p = { ...parto, faseManual: f }
    await db.putParto(p)
    setPartos((ps) => ps.map((x) => (x.id === p.id ? p : x)))
  }
  const newParto = async (nome: string) => {
    const p: Parto = { id: uid(), nome, criadoEm: Date.now(), faseManual: null }
    await db.putParto(p)
    setPartos((ps) => [...ps, p])
    await setSettings({ ...settings!, partoAtivoId: p.id })
    setEvents([])
  }
  const switchParto = async (id: string) => {
    await setSettings({ ...settings!, partoAtivoId: id })
    setEvents(await db.eventsByParto(id))
  }

  if (!ready || !settings || !parto) return <div className="loading">Carregando…</div>

  const value: Store = {
    ready,
    settings,
    parto,
    partos,
    events,
    running,
    now,
    addEvent,
    updateEvent,
    removeEvent,
    startContraction,
    stopContraction,
    cancelContraction,
    setSettings,
    setFaseManual,
    newParto,
    switchParto,
    reload: load,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

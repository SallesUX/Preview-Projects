import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { db, onDbChange, requestPersistence, uid } from './db'
import { enqueue, onRemoteChange, runKey } from './sync'
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
  /** delete every record of the active parto and start it over */
  resetParto: () => Promise<void>
  reload: () => Promise<void>
  /** logged-in account (or, in the admin view, the account being watched) */
  usuario: { id: string; nome: string; nuvem?: boolean }
  logout: () => void
  /** admin live view: shows the user's screen, nothing can be changed */
  readOnly: boolean
}

const Ctx = createContext<Store | null>(null)
export const useStore = () => {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore outside provider')
  return s
}

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

export function StoreProvider({
  usuario,
  onLogout,
  readOnly = false,
  children,
}: {
  usuario: { id: string; nome: string; nuvem?: boolean }
  onLogout: () => void
  readOnly?: boolean
  children: ReactNode
}) {
  const RUN_KEY = runKey(usuario.id)
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
    const all = await db.partos()
    let ps = all.filter((p) => p.userId === usuario.id)
    if (readOnly) {
      // watching someone else's data: read only, never claim or create anything
      const st0 = await db.getSettings(usuario.id)
      if (ps.length === 0) ps = [{ id: '-', nome: 'Sem parto ainda', criadoEm: 0, faseManual: null, userId: usuario.id }]
      let st = st0 ?? defaultSettings(ps[0].id)
      if (!ps.find((p) => p.id === st.partoAtivoId)) st = { ...st, partoAtivoId: ps[0].id }
      setPartos(ps.sort((a, b) => a.criadoEm - b.criadoEm))
      setSettingsState(st)
      setEvents(await db.eventsByParto(st.partoAtivoId))
      const r = localStorage.getItem(RUN_KEY)
      setRunning(r ? Number(r) : null)
      setReady(true)
      return
    }
    // data from before accounts existed goes to the first person who logs in
    const orfaos = all.filter((p) => !p.userId)
    for (const p of orfaos) {
      const own = { ...p, userId: usuario.id }
      await db.putParto(own)
      ps.push(own)
    }
    let st = (await db.getSettings(usuario.id)) ?? (orfaos.length ? await db.getSettings() : undefined)
    if (ps.length === 0) {
      const p: Parto = { id: uid(), nome: 'Nosso parto', criadoEm: Date.now(), faseManual: null, userId: usuario.id }
      await db.putParto(p)
      ps = [p]
    }
    const salvo = st
    if (!st) st = defaultSettings(ps[0].id)
    if (!ps.find((p) => p.id === st!.partoAtivoId)) st = { ...st, partoAtivoId: ps[0].id }
    if (st !== salvo) await db.putSettings(st, usuario.id)
    const r = localStorage.getItem(RUN_KEY)
    setRunning(r ? Number(r) : null)
    setPartos(ps.sort((a, b) => a.criadoEm - b.criadoEm))
    setSettingsState(st)
    setEvents(await db.eventsByParto(st.partoAtivoId))
    setReady(true)
  }, [usuario.id, readOnly, RUN_KEY])

  // own screen: reload when data arrives from the cloud (another device, or the admin pulled)
  useEffect(() => {
    if (readOnly) return
    return onRemoteChange(load)
  }, [readOnly, load])

  // live view: reload whenever any tab writes, when the running contraction changes,
  // and every few seconds as a fallback
  useEffect(() => {
    if (!readOnly) return
    const off = onDbChange(load)
    const onStorage = (e: StorageEvent) => e.key === RUN_KEY && load()
    window.addEventListener('storage', onStorage)
    const t = setInterval(load, 5000)
    return () => {
      off()
      window.removeEventListener('storage', onStorage)
      clearInterval(t)
    }
  }, [readOnly, load, RUN_KEY])

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
    enqueue('estado', usuario.id)
    navigator.vibrate?.(30)
  }
  const cancelContraction = () => {
    localStorage.removeItem(RUN_KEY)
    setRunning(null)
    enqueue('estado', usuario.id)
  }
  const stopContraction = async () => {
    if (!running) return null
    const ev = await addEvent({ tipo: 'contracao', inicio: running, fim: Date.now() })
    cancelContraction()
    navigator.vibrate?.([20, 40, 20])
    return ev
  }

  useEffect(() => {
    if (settings && !readOnly) applyTheme(settings.tema)
  }, [settings?.tema, readOnly])

  const setSettings = async (s: Settings) => {
    await db.putSettings(s, usuario.id)
    setSettingsState(s)
  }
  const setFaseManual = async (f: PhaseId | null) => {
    const p = { ...parto, faseManual: f }
    await db.putParto(p)
    setPartos((ps) => ps.map((x) => (x.id === p.id ? p : x)))
  }
  const newParto = async (nome: string) => {
    const p: Parto = { id: uid(), nome, criadoEm: Date.now(), faseManual: null, userId: usuario.id }
    await db.putParto(p)
    setPartos((ps) => [...ps, p])
    await setSettings({ ...settings!, partoAtivoId: p.id })
    setEvents([])
  }
  const resetParto = async () => {
    const all = await db.eventsByParto(parto.id)
    for (const e of all) {
      await db.deleteEvent(e.id)
      if (e.audioId) await db.deleteAudio(e.audioId)
    }
    const p = { ...parto, faseManual: null }
    await db.putParto(p)
    setPartos((ps) => ps.map((x) => (x.id === p.id ? p : x)))
    cancelContraction()
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
    resetParto,
    switchParto,
    reload: load,
    usuario,
    logout: onLogout,
    readOnly,
  }
  if (readOnly) {
    const nada = async () => {}
    Object.assign(value, {
      addEvent: async (e: Omit<DuleEvent, 'id' | 'partoId'>) => ({ ...e, id: '', partoId: parto.id }),
      updateEvent: nada,
      removeEvent: nada,
      startContraction: () => {},
      stopContraction: async () => null,
      cancelContraction: () => {},
      setSettings: nada,
      setFaseManual: nada,
      newParto: nada,
      switchParto: nada,
      resetParto: nada,
    })
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

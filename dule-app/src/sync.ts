/**
 * Cloud sync (Supabase). IndexedDB stays the source the screens read from, so the app keeps
 * working offline; this module
 *  - queues every local change in the `outbox` store and sends it when there is a cloud session,
 *  - pulls the cloud copy into IndexedDB (own data, or everything for the admin),
 *  - listens to Supabase Realtime and pulls again whenever something changes.
 */
import { db, notifyChange, setOutboxHook, type OutboxItem, type SyncTable } from './db'
import { supabase, isNetworkError } from './supabase'
import type { DuleEvent, Parto, Settings } from './types'

export const runKey = (userId: string) => `dule.running:${userId}`

let activeUser: string | null = null
let adminMode = false
let adminNaNuvem: boolean | null = null
let flushing = false
let pulling = false
let pullAgain = false
let flushTimer: number | null = null
let pullTimer: number | null = null
let tick: number | null = null
let channel: ReturnType<typeof supabase.channel> | null = null

const remoteListeners = new Set<() => void>()
/** Called after cloud data has been written locally. */
export function onRemoteChange(fn: () => void) {
  remoteListeners.add(fn)
  return () => void remoteListeners.delete(fn)
}

// every local write lands here (see db.ts); tag it with whoever is using the app
setOutboxHook(({ table, id, op }) => {
  if (!activeUser) return
  db.putOutbox({ k: `${table}:${id}`, table, id, op, owner: activeUser }).then(scheduleFlush)
})

/** Queue a record that is not written through db.ts (the running contraction lives in localStorage). */
export function enqueue(table: SyncTable, id: string, op: OutboxItem['op'] = 'upsert') {
  if (!activeUser) return
  db.putOutbox({ k: `${table}:${id}`, table, id, op, owner: activeUser }).then(scheduleFlush)
}

export const setActiveUser = (id: string | null) => (activeUser = id)

function scheduleFlush() {
  if (flushTimer != null) window.clearTimeout(flushTimer)
  flushTimer = window.setTimeout(() => void flush(), 400)
}
function schedulePull() {
  if (pullTimer != null) window.clearTimeout(pullTimer)
  pullTimer = window.setTimeout(() => void pull(), 500)
}

async function sessionUser(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.user.id ?? null
}

const ok = <T extends { error: unknown }>(r: T) => {
  if (r.error) throw r.error
  return r
}

async function push(item: OutboxItem, me: string) {
  const del = (table: string, col = 'id') => supabase.from(table).delete().eq(col, item.id).then(ok)
  switch (item.table) {
    case 'partos': {
      const p = (await db.partos()).find((x) => x.id === item.id)
      if (item.op === 'delete' || !p) return del('partos')
      return supabase
        .from('partos')
        .upsert({ id: p.id, user_id: me, nome: p.nome, criado_em: p.criadoEm, fase_manual: p.faseManual, updated_at: new Date().toISOString() })
        .then(ok)
    }
    case 'events': {
      const e = await db.getEvent(item.id)
      if (item.op === 'delete' || !e) return del('events')
      return supabase
        .from('events')
        .upsert({ id: e.id, user_id: me, parto_id: e.partoId, inicio: e.inicio, data: e, updated_at: new Date().toISOString() })
        .then(ok)
    }
    case 'settings': {
      const s = await db.getSettings(item.id)
      if (!s) return
      return supabase.from('settings').upsert({ user_id: me, data: s, updated_at: new Date().toISOString() }).then(ok)
    }
    case 'estado': {
      let running: number | null = null
      try {
        const v = localStorage.getItem(runKey(me))
        running = v ? Number(v) : null
      } catch {}
      return supabase.from('estado').upsert({ user_id: me, running, updated_at: new Date().toISOString() }).then(ok)
    }
    case 'audio': {
      const path = `${me}/${item.id}`
      const blob = item.op === 'delete' ? undefined : await db.getAudio(item.id)
      if (!blob) return supabase.storage.from('audio').remove([path]).then(ok)
      return supabase.storage.from('audio').upload(path, blob, { upsert: true, contentType: blob.type || 'audio/webm' }).then(ok)
    }
  }
}

/** Send queued changes. Stops at the first network error and retries later. */
export async function flush() {
  if (flushing) return
  flushing = true
  try {
    const me = await sessionUser()
    if (!me) return
    const items = (await db.outbox()).filter((i) => i.owner === me)
    for (const item of items) {
      try {
        await push(item, me)
        await db.deleteOutbox(item.k)
      } catch (e) {
        if (isNetworkError(e)) break
        // refused by the server (e.g. permissions): keep it queued, so the local copy is never
        // treated as deleted, and try the remaining items
        console.warn('sync: not sent', item.k, e)
      }
    }
  } finally {
    flushing = false
  }
}

/** Supabase returns at most 1000 rows per request; page through the whole table. */
async function fetchAll<T>(table: string): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select('*').range(from, from + 999)
    if (error) throw error
    out.push(...((data ?? []) as T[]))
    if (!data || data.length < 1000) return out
  }
}

type RowParto = { id: string; user_id: string; nome: string; criado_em: number; fase_manual: Parto['faseManual'] }
type RowEvent = { id: string; user_id: string; parto_id: string; data: DuleEvent }
type RowSettings = { user_id: string; data: Settings }
type RowEstado = { user_id: string; running: number | null }
type RowProfile = { id: string; nome: string; nome_chave: string; is_admin: boolean; criado_em: string }

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/** Bring the cloud copy into IndexedDB. Records with local changes still queued are left alone. */
export async function pull() {
  if (pulling) {
    pullAgain = true
    return
  }
  pulling = true
  try {
    const me = await sessionUser()
    if (!me) return
    await flush()
    const [profiles, partos, events, settings, estado, outbox] = await Promise.all([
      fetchAll<RowProfile>('profiles'),
      fetchAll<RowParto>('partos'),
      fetchAll<RowEvent>('events'),
      fetchAll<RowSettings>('settings'),
      fetchAll<RowEstado>('estado'),
      db.outbox(),
    ])
    const pending = new Set(outbox.map((i) => i.k))
    adminNaNuvem = profiles.find((p) => p.id === me)?.is_admin ?? false
    const scope = new Set(adminMode ? profiles.map((p) => p.id) : [me])
    scope.add(me)

    // accounts (the admin needs names; keep any local password hash for offline login)
    const users = await db.users()
    for (const p of profiles) {
      const cur = users.find((u) => u.id === p.id)
      const next = { senhaHash: '', sal: '', ...cur, id: p.id, nome: p.nome, chave: p.nome_chave, criadoEm: cur?.criadoEm ?? Date.parse(p.criado_em) }
      if (!same(cur, next)) await db.putUser(next)
    }

    // partos
    const localPartos = await db.partos()
    const remotePartoIds = new Set(partos.map((r) => r.id))
    for (const r of partos) {
      if (pending.has(`partos:${r.id}`)) continue
      const next: Parto = { id: r.id, nome: r.nome, criadoEm: Number(r.criado_em), faseManual: r.fase_manual ?? null, userId: r.user_id }
      const cur = localPartos.find((p) => p.id === r.id)
      if (!same(cur, next)) await db.putParto(next, { remote: true })
    }
    for (const p of localPartos)
      if (p.userId && scope.has(p.userId) && !remotePartoIds.has(p.id) && !pending.has(`partos:${p.id}`))
        await db.deleteParto(p.id, { remote: true })

    // events
    const localEvents = await db.allEvents()
    const remoteEventIds = new Set(events.map((r) => r.id))
    const scopeParto = new Set([...localPartos, ...partos.map((r) => ({ id: r.id, userId: r.user_id }))].filter((p) => p.userId && scope.has(p.userId)).map((p) => p.id))
    for (const r of events) {
      if (pending.has(`events:${r.id}`)) continue
      const next: DuleEvent = { ...r.data, id: r.id, partoId: r.parto_id }
      const cur = localEvents.find((e) => e.id === r.id)
      if (!same(cur, next)) await db.putEvent(next, { remote: true })
    }
    for (const e of localEvents)
      if (scopeParto.has(e.partoId) && !remoteEventIds.has(e.id) && !pending.has(`events:${e.id}`))
        await db.deleteEvent(e.id, { remote: true })

    // settings
    for (const r of settings) {
      if (pending.has(`settings:${r.user_id}`)) continue
      const cur = await db.getSettings(r.user_id)
      if (!same(cur, r.data)) await db.putSettings(r.data, r.user_id, { remote: true })
    }

    // running contraction (lives in localStorage)
    for (const r of estado) {
      if (pending.has(`estado:${r.user_id}`)) continue
      try {
        if (r.running) localStorage.setItem(runKey(r.user_id), String(r.running))
        else localStorage.removeItem(runKey(r.user_id))
      } catch {}
    }

    notifyChange()
    remoteListeners.forEach((fn) => fn())
  } catch (e) {
    if (!isNetworkError(e)) console.warn('sync: pull failed', e)
  } finally {
    pulling = false
    if (pullAgain) {
      pullAgain = false
      schedulePull()
    }
  }
}

/** Start syncing for whoever just logged in (userId = cloud user id when there is one). */
export function start(userId: string | null, opts: { admin?: boolean } = {}) {
  stop()
  activeUser = userId
  adminMode = !!opts.admin
  void pull()
  channel = supabase.channel('dule-sync')
  for (const table of ['partos', 'events', 'settings', 'estado', 'profiles'])
    channel.on('postgres_changes', { event: '*', schema: 'public', table }, schedulePull)
  channel.subscribe()
  tick = window.setInterval(() => void pull(), 20_000)
  window.addEventListener('online', onOnline)
}

export function stop() {
  if (channel) void supabase.removeChannel(channel)
  channel = null
  if (tick != null) window.clearInterval(tick)
  tick = null
  window.removeEventListener('online', onOnline)
  activeUser = null
  adminMode = false
  adminNaNuvem = null
}

const onOnline = () => void pull()

/** null = not known yet (offline or not logged in to the cloud). */
export const adminLiberado = () => adminNaNuvem

/** How many local changes are still waiting to reach the cloud. */
export async function pendentes(userId: string) {
  return (await db.outbox()).filter((i) => i.owner === userId).length
}

/** Download an audio recorded on another device and keep a local copy. */
export async function fetchAudio(ownerId: string, audioId: string): Promise<Blob | undefined> {
  try {
    const { data, error } = await supabase.storage.from('audio').download(`${ownerId}/${audioId}`)
    if (error || !data) return undefined
    await db.putAudio(audioId, data, { remote: true })
    return data
  } catch {
    return undefined
  }
}

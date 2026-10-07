/**
 * Minimal IndexedDB wrapper. Everything stays on the device.
 * Stores: events (DuleEvent), partos (Parto), audio (Blob by id), kv (settings).
 */
import type { DuleEvent, Parto, Settings } from './types'

const DB_NAME = 'dule'
const DB_VERSION = 1

let dbPromise: Promise<IDBDatabase> | null = null

function open(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('events')) {
        const s = db.createObjectStore('events', { keyPath: 'id' })
        s.createIndex('partoId', 'partoId')
      }
      if (!db.objectStoreNames.contains('partos')) db.createObjectStore('partos', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('audio')) db.createObjectStore('audio')
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv')
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode)
        const req = fn(t.objectStore(store))
        t.oncomplete = () => resolve(req ? (req.result as T) : (undefined as T))
        t.onerror = () => reject(t.error)
        t.onabort = () => reject(t.error)
      }),
  )
}

export const db = {
  // events
  eventsByParto: (partoId: string) =>
    tx<DuleEvent[]>('events', 'readonly', (s) => s.index('partoId').getAll(partoId)).then((list) =>
      list.sort((a, b) => a.inicio - b.inicio),
    ),
  putEvent: (e: DuleEvent) => tx('events', 'readwrite', (s) => s.put(e)),
  deleteEvent: (id: string) => tx('events', 'readwrite', (s) => s.delete(id)),
  allEvents: () => tx<DuleEvent[]>('events', 'readonly', (s) => s.getAll()),

  // partos
  partos: () => tx<Parto[]>('partos', 'readonly', (s) => s.getAll()),
  putParto: (p: Parto) => tx('partos', 'readwrite', (s) => s.put(p)),

  // audio
  putAudio: (id: string, blob: Blob) => tx('audio', 'readwrite', (s) => s.put(blob, id)),
  getAudio: (id: string) => tx<Blob | undefined>('audio', 'readonly', (s) => s.get(id)),
  deleteAudio: (id: string) => tx('audio', 'readwrite', (s) => s.delete(id)),

  // settings
  getSettings: () => tx<Settings | undefined>('kv', 'readonly', (s) => s.get('settings')),
  putSettings: (v: Settings) => tx('kv', 'readwrite', (s) => s.put(v, 'settings')),
}

export const uid = () =>
  (crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`)

/** Ask the browser not to evict our data under storage pressure. */
export const requestPersistence = () => navigator.storage?.persist?.().catch(() => false)

// ---------- Backup ----------

const blobToDataUrl = (b: Blob) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result as string)
    r.onerror = () => rej(r.error)
    r.readAsDataURL(b)
  })

export async function exportBackup(): Promise<Blob> {
  const [events, partos, settings] = await Promise.all([db.allEvents(), db.partos(), db.getSettings()])
  const audio: Record<string, string> = {}
  for (const e of events) {
    if (e.audioId) {
      const b = await db.getAudio(e.audioId)
      if (b) audio[e.audioId] = await blobToDataUrl(b)
    }
  }
  const data = { app: 'dule', versao: 1, exportadoEm: Date.now(), events, partos, settings, audio }
  return new Blob([JSON.stringify(data)], { type: 'application/json' })
}

export async function importBackup(file: File) {
  const data = JSON.parse(await file.text())
  if (data.app !== 'dule') throw new Error('Arquivo não é um backup do Dule.app')
  for (const p of data.partos ?? []) await db.putParto(p)
  for (const e of data.events ?? []) await db.putEvent(e)
  for (const [id, url] of Object.entries<string>(data.audio ?? {})) {
    const blob = await (await fetch(url)).blob()
    await db.putAudio(id, blob)
  }
  if (data.settings) await db.putSettings(data.settings)
}

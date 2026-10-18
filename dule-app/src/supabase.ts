import { createClient } from '@supabase/supabase-js'

// Public project values: the anon key is meant to ship in the app. Access is controlled by
// row-level security in the database (see supabase/schema.sql).
const SUPABASE_URL = 'https://eyxejdoahsejdyqjrrgv.supabase.co'
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV5eGVqZG9haHNlamR5cWpycmd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIyODQ4MzgsImV4cCI6MjEwNzg2MDgzOH0.Z3FdcYyH05yeIV51kqVxW2lsrlKGyMGpkG1DsPHPrio'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'dule.nuvem' },
})

/** True for errors that mean "could not reach the server" (offline, blocked), not a real answer. */
export function isNetworkError(e: unknown): boolean {
  const err = e as { name?: string; message?: string; status?: number } | null
  if (!err) return false
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
  return (
    err.name === 'AuthRetryableFetchError' ||
    err.name === 'TypeError' ||
    err.status === 0 ||
    /fetch|network|load failed|failed to/i.test(err.message ?? '')
  )
}

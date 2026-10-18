/**
 * Accounts. With internet, login and sign-up go through Supabase Auth (name + password; the
 * name is turned into a hidden e-mail address because Supabase needs one). A local copy of each
 * account is kept so the app also opens offline. Accounts that only existed on this phone
 * (before the cloud version) are moved to the cloud, with all their data, the first time their
 * owner logs in online.
 */
import { db, uid } from './db'
import { supabase, isNetworkError } from './supabase'
import { enqueue, runKey, setActiveUser } from './sync'
import type { Usuario } from './types'

export type Sessao =
  | { tipo: 'usuario'; id: string; nome: string; nuvem: boolean }
  | { tipo: 'admin'; id: string | null; nuvem: boolean; nome?: string }

const SESSION_KEY = 'dule.sessao'

export const ADMIN_USER = 'AdminDule'
/** hash('dule-admin:' + password); the password itself is not in the bundle. Second entry = fallback hash. */
const ADMIN_HASHES = ['fa4972bad9bb7cf49a32ecd78a7b600897c14a902e418472ac924088e4d4e4a9', 'fnv-315daeaa']

async function sha256(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text)
  if (crypto.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', bytes)
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
  }
  // crypto.subtle only exists on https/localhost; plain-http dev on the LAN falls back
  // to a simple (non-cryptographic) hash so the app still works there (local accounts only).
  let h = 0x811c9dc5
  for (const b of bytes) h = Math.imul(h ^ b, 0x01000193) >>> 0
  return `fnv-${h.toString(16)}`
}

const chave = (nome: string) => nome.trim().toLowerCase()
/** Hidden e-mail for Supabase, derived from the name (same name → same account). */
const emailDe = async (nome: string) => `u${(await sha256(`dule-user:${chave(nome)}`)).slice(0, 32)}@dule.app`
/** Supabase wants ≥ 6 characters; the app allows 4, so the cloud password gets a fixed prefix. */
const senhaNuvem = (senha: string) => `dule:${senha}`

export function sessaoAtual(): Sessao | null {
  try {
    const v = localStorage.getItem(SESSION_KEY)
    if (!v) return null
    const s = JSON.parse(v) as Sessao
    return 'nuvem' in s ? s : null // sessions from before the cloud version: log in again
  } catch {
    return null
  }
}

function salvarSessao(s: Sessao | null) {
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s))
    else localStorage.removeItem(SESSION_KEY)
  } catch {}
}

export async function sair() {
  salvarSessao(null)
  try {
    await supabase.auth.signOut({ scope: 'local' })
  } catch {}
}

type Nuvem = { id: string } | 'invalida' | 'existe' | 'offline'

async function entrarNuvem(nome: string, senha: string): Promise<Nuvem> {
  if (!crypto.subtle) return 'offline'
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email: await emailDe(nome), password: senhaNuvem(senha) })
    if (!error && data.user) return { id: data.user.id }
    return isNetworkError(error) ? 'offline' : 'invalida'
  } catch (e) {
    if (isNetworkError(e)) return 'offline'
    throw e
  }
}

async function cadastrarNuvem(nome: string, senha: string): Promise<Nuvem> {
  if (!crypto.subtle) return 'offline'
  try {
    const { data, error } = await supabase.auth.signUp({
      email: await emailDe(nome),
      password: senhaNuvem(senha),
      options: { data: { nome: nome.trim() } },
    })
    if (error) {
      if (isNetworkError(error)) return 'offline'
      if (/already|registered|exists/i.test(error.message) || (error as { code?: string }).code === 'user_already_exists') return 'existe'
      throw new Error(`Não foi possível criar a conta na nuvem: ${error.message}`)
    }
    if (!data.session || !data.user)
      throw new Error('A nuvem pediu confirmação por e-mail. Desligue "Confirm email" no Supabase (Authentication → Email).')
    return { id: data.user.id }
  } catch (e) {
    if (isNetworkError(e)) return 'offline'
    throw e
  }
}

/** Keep (or create) the local copy of a cloud account, so the same login works offline. */
async function guardarLocal(id: string, nome: string, senha: string, admin?: boolean) {
  const users = await db.users()
  const cur = users.find((u) => u.id === id)
  const sal = uid()
  await db.putUser({
    id,
    nome: nome.trim(),
    chave: chave(nome),
    sal,
    senhaHash: await sha256(`${sal}:${senha}`),
    criadoEm: cur?.criadoEm ?? Date.now(),
    admin: admin ?? cur?.admin,
  })
}

/** Does this cloud account have admin rights (profiles.is_admin)? Unknown counts as no. */
async function ehAdminNaNuvem(id: string): Promise<boolean> {
  try {
    const { data } = await supabase.from('profiles').select('id,is_admin').eq('id', id)
    return !!data?.find((r) => r.id === id)?.is_admin
  } catch {
    return false
  }
}

/**
 * An account that existed only on this phone now has a cloud id: move its partos, records,
 * settings and audio to the new id and queue everything for upload.
 */
async function moverParaNuvem(localId: string, cloudId: string) {
  setActiveUser(cloudId) // queued changes below belong to the cloud account
  const partos = (await db.partos()).filter((p) => p.userId === localId || (!p.userId && localId === cloudId))
  const ids = new Set(partos.map((p) => p.id))
  for (const p of partos) await db.putParto({ ...p, userId: cloudId })
  for (const e of (await db.allEvents()).filter((e) => ids.has(e.partoId))) {
    await db.putEvent(e)
    if (e.audioId) enqueue('audio', e.audioId)
  }
  const st = await db.getSettings(localId)
  if (st) {
    await db.putSettings(st, cloudId)
    if (localId !== cloudId) await db.deleteSettings(localId)
  }
  try {
    const r = localStorage.getItem(runKey(localId))
    if (r && localId !== cloudId) {
      localStorage.setItem(runKey(cloudId), r)
      localStorage.removeItem(runKey(localId))
    }
    if (r) enqueue('estado', cloudId)
  } catch {}
  for (const i of await db.outbox()) if (i.owner === localId) await db.putOutbox({ ...i, owner: cloudId })
  if (localId !== cloudId) await db.deleteUser(localId)
}

async function locaisCom(nome: string, senha: string): Promise<Usuario | null> {
  const u = (await db.users()).find((x) => x.chave === chave(nome))
  if (!u || !u.senhaHash) return null
  return (await sha256(`${u.sal}:${senha}`)) === u.senhaHash ? u : null
}

export async function cadastrar(nome: string, senha: string): Promise<Sessao> {
  const n = nome.trim()
  if (n.length < 2) throw new Error('Escreva um nome com pelo menos 2 letras.')
  if (senha.length < 4) throw new Error('A senha precisa ter pelo menos 4 caracteres.')
  if (chave(n) === chave(ADMIN_USER)) throw new Error('Esse nome é reservado. Escolha outro.')
  if ((await db.users()).some((u) => u.chave === chave(n) && u.senhaHash))
    throw new Error('Já existe um cadastro com esse nome neste celular. Use "Entrar".')
  const r = await cadastrarNuvem(n, senha)
  if (r === 'existe') throw new Error('Já existe um cadastro com esse nome.')
  // offline: create the account on this phone only; it moves to the cloud at the next online login
  const id = typeof r === 'object' ? r.id : uid()
  await guardarLocal(id, n, senha)
  const s: Sessao = { tipo: 'usuario', id, nome: n, nuvem: typeof r === 'object' }
  salvarSessao(s)
  return s
}

export async function entrar(nome: string, senha: string): Promise<Sessao> {
  const errado = new Error('Usuário ou senha incorretos.')

  if (chave(nome) === chave(ADMIN_USER)) {
    if (!ADMIN_HASHES.includes(await sha256(`dule-admin:${senha}`))) throw errado
    let r = await entrarNuvem(ADMIN_USER, senha)
    if (r === 'invalida') r = await cadastrarNuvem(ADMIN_USER, senha)
    if (r === 'existe') throw new Error('A conta admin na nuvem tem outra senha.')
    const s: Sessao = { tipo: 'admin', id: typeof r === 'object' ? r.id : null, nuvem: typeof r === 'object' }
    salvarSessao(s)
    return s
  }

  const r = await entrarNuvem(nome, senha)
  if (typeof r === 'object') {
    // same name may still have an older phone-only account here: bring it along
    const local = await locaisCom(nome, senha)
    if (local && local.id !== r.id) await moverParaNuvem(local.id, r.id)
    const admin = await ehAdminNaNuvem(r.id)
    await guardarLocal(r.id, nome, senha, admin)
    const u = (await db.users()).find((x) => x.id === r.id)!
    // accounts given admin rights in the database (e.g. Amanda) open the admin area
    const s: Sessao = admin ? { tipo: 'admin', id: r.id, nuvem: true, nome: u.nome } : { tipo: 'usuario', id: r.id, nome: u.nome, nuvem: true }
    salvarSessao(s)
    return s
  }

  const local = await locaisCom(nome, senha)
  if (!local) throw errado

  if (r === 'invalida') {
    // phone-only account (made before the cloud version, or offline): create it in the cloud now
    const c = await cadastrarNuvem(local.nome, senha)
    if (c === 'existe') throw errado
    if (typeof c === 'object') {
      await moverParaNuvem(local.id, c.id)
      await guardarLocal(c.id, local.nome, senha)
      const s: Sessao = { tipo: 'usuario', id: c.id, nome: local.nome, nuvem: true }
      salvarSessao(s)
      return s
    }
  }

  // offline: open with the local copy; sync resumes once there is internet
  const s: Sessao = local.admin
    ? { tipo: 'admin', id: local.id, nuvem: false, nome: local.nome }
    : { tipo: 'usuario', id: local.id, nome: local.nome, nuvem: false }
  salvarSessao(s)
  return s
}

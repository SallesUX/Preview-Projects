/**
 * Local accounts. Everything stays on this device: this is a lock between people
 * sharing the phone, not server-grade security (anyone with the device and dev tools
 * can read IndexedDB).
 */
import { db, uid } from './db'
import type { Usuario } from './types'

export type Sessao = { tipo: 'usuario'; id: string; nome: string } | { tipo: 'admin' }

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
  // to a simple (non-cryptographic) hash so the app still works there.
  let h = 0x811c9dc5
  for (const b of bytes) h = Math.imul(h ^ b, 0x01000193) >>> 0
  return `fnv-${h.toString(16)}`
}

const chave = (nome: string) => nome.trim().toLowerCase()

export function sessaoAtual(): Sessao | null {
  try {
    const v = localStorage.getItem(SESSION_KEY)
    return v ? (JSON.parse(v) as Sessao) : null
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

export const sair = () => salvarSessao(null)

export async function cadastrar(nome: string, senha: string): Promise<Sessao> {
  const n = nome.trim()
  if (n.length < 2) throw new Error('Escreva um nome com pelo menos 2 letras.')
  if (senha.length < 4) throw new Error('A senha precisa ter pelo menos 4 caracteres.')
  if (chave(n) === chave(ADMIN_USER)) throw new Error('Esse nome é reservado. Escolha outro.')
  const users = await db.users()
  if (users.some((u) => u.chave === chave(n))) throw new Error('Já existe um cadastro com esse nome.')
  const sal = uid()
  const u: Usuario = { id: uid(), nome: n, chave: chave(n), sal, senhaHash: await sha256(`${sal}:${senha}`), criadoEm: Date.now() }
  await db.putUser(u)
  const s: Sessao = { tipo: 'usuario', id: u.id, nome: u.nome }
  salvarSessao(s)
  return s
}

export async function entrar(nome: string, senha: string): Promise<Sessao> {
  const errado = new Error('Usuário ou senha incorretos.')
  if (chave(nome) === chave(ADMIN_USER)) {
    if (!ADMIN_HASHES.includes(await sha256(`dule-admin:${senha}`))) throw errado
    const s: Sessao = { tipo: 'admin' }
    salvarSessao(s)
    return s
  }
  const u = (await db.users()).find((x) => x.chave === chave(nome))
  if (!u || (await sha256(`${u.sal}:${senha}`)) !== u.senhaHash) throw errado
  const s: Sessao = { tipo: 'usuario', id: u.id, nome: u.nome }
  salvarSessao(s)
  return s
}

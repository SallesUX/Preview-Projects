import { useState, type FormEvent } from 'react'
import { cadastrar, entrar, type Sessao } from '../auth'

export function Login({ onLogin }: { onLogin: (s: Sessao) => void }) {
  const [modo, setModo] = useState<'entrar' | 'cadastro'>('entrar')
  const [nome, setNome] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const trocar = (m: typeof modo) => {
    setModo(m)
    setErro(null)
    setSenha('')
  }

  const submit = async (ev: FormEvent) => {
    ev.preventDefault()
    setErro(null)
    setEnviando(true)
    try {
      onLogin(modo === 'entrar' ? await entrar(nome, senha) : await cadastrar(nome, senha))
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="login">
      <div className="login-brand">
        <img src="/icon.svg" alt="" width="64" height="64" />
        <h1>Dule.app</h1>
        <p>Acompanhamento do trabalho de parto</p>
      </div>

      <form className="login-card" onSubmit={submit}>
        <h2>{modo === 'entrar' ? 'Entrar' : 'Criar cadastro'}</h2>
        <label className="login-field">
          <span>{modo === 'entrar' ? 'Usuário' : 'Nome'}</span>
          <input
            id="login-nome"
            className="field"
            autoComplete="username"
            autoCapitalize="none"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
          />
        </label>
        <label className="login-field">
          <span>Senha</span>
          <input
            id="login-senha"
            className="field"
            type="password"
            autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
          />
        </label>
        {erro && (
          <p className="login-erro" role="alert">
            {erro}
          </p>
        )}
        <button className="primary" type="submit" disabled={enviando}>
          {modo === 'entrar' ? 'Entrar' : 'Criar cadastro'}
        </button>
        <p className="login-switch">
          {modo === 'entrar' ? (
            <>
              Ainda não tem conta?{' '}
              <button type="button" className="link-btn" onClick={() => trocar('cadastro')}>
                Criar cadastro
              </button>
            </>
          ) : (
            <>
              Já tem conta?{' '}
              <button type="button" className="link-btn" onClick={() => trocar('entrar')}>
                Entrar
              </button>
            </>
          )}
        </p>
      </form>

      <p className="login-note">Os dados ficam só neste celular.</p>
    </div>
  )
}

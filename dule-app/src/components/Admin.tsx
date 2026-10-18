import { useCallback, useEffect, useMemo, useState } from 'react'
import { db, onDbChange } from '../db'
import { adminLiberado } from '../sync'
import { StoreProvider } from '../store'
import App from '../App'
import { phaseById } from '../content'
import { MIN, contractions, currentPhase, durSec, fmtAgo, fmtClock, fmtMin, inWindow, statsFor } from '../logic'
import type { DuleEvent, Parto, Usuario } from '../types'

interface Linha {
  c: DuleEvent
  parto: Parto
  dono: string
  /** minutes since the previous contraction of the same parto */
  intervalo: number | null
}

const fmtData = (t: number) =>
  new Date(t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

export function Admin({ onLogout, nuvem }: { onLogout: () => void; nuvem: boolean }) {
  const [users, setUsers] = useState<Usuario[]>([])
  const [partos, setPartos] = useState<Parto[]>([])
  const [events, setEvents] = useState<DuleEvent[]>([])
  const [aba, setAba] = useState<'dashboard' | 'historico' | 'tela'>('dashboard')
  const [vendo, setVendo] = useState<Usuario | null>(null)
  const [atualizado, setAtualizado] = useState<number | null>(null)
  const [liberado, setLiberado] = useState<boolean | null>(null)
  const [filtro, setFiltro] = useState('todos')
  const [msg, setMsg] = useState<string | null>(null)
  const [now, setNow] = useState(Date.now())

  const carregar = useCallback(async () => {
    const [u, p, e] = await Promise.all([db.users(), db.partos(), db.allEvents()])
    setUsers(u.filter((x) => x.chave !== 'admindule').sort((a, b) => a.nome.localeCompare(b.nome)))
    setLiberado(adminLiberado())
    setPartos(p)
    setEvents(e)
    setNow(Date.now())
    setAtualizado(Date.now())
  }, [])

  // live: reload on every write from any tab, plus a 5 s fallback
  useEffect(() => {
    carregar()
    const off = onDbChange(carregar)
    const t = setInterval(carregar, 5000)
    return () => {
      off()
      clearInterval(t)
    }
  }, [carregar])

  const nomeDe = (userId?: string) => users.find((u) => u.id === userId)?.nome ?? 'Sem dono'
  const partosVisiveis = partos.filter((p) => filtro === 'todos' || p.userId === filtro)

  const porParto = useMemo(
    () =>
      partosVisiveis.map((p) => {
        const evs = events.filter((e) => e.partoId === p.id)
        const cs = contractions(evs)
        const hora = statsFor(inWindow(cs, now, 60))
        const fase = currentPhase(evs, now, p.faseManual)
        // contractions per hour over the last 6 hours, oldest first
        const barras = Array.from({ length: 6 }, (_, i) => {
          const fim = now - (5 - i) * 60 * MIN
          return cs.filter((c) => c.inicio > fim - 60 * MIN && c.inicio <= fim).length
        })
        return { p, cs, hora, fase, barras }
      }),
    [partosVisiveis, events, now],
  )

  const linhas: Linha[] = useMemo(() => {
    const out: Linha[] = []
    for (const { p, cs } of porParto) {
      cs.forEach((c, i) =>
        out.push({ c, parto: p, dono: nomeDe(p.userId), intervalo: i ? (c.inicio - cs[i - 1].inicio) / MIN : null }),
      )
    }
    return out.sort((a, b) => b.c.inicio - a.c.inicio)
  }, [porParto, users])

  const total24h = linhas.filter((l) => l.c.inicio >= now - 24 * 60 * MIN).length

  const texto = () => {
    const quem = filtro === 'todos' ? 'Todos os usuários' : nomeDe(filtro)
    const out = [`Dule.app · histórico de contrações`, `${quem} · ${fmtData(now)}`, '']
    for (const { p, cs, hora, fase } of porParto) {
      out.push(`${nomeDe(p.userId)} · ${p.nome}`)
      out.push(
        `  ${cs.length} contrações · fase: ${fase ? phaseById(fase).nome : '—'} · última hora: a cada ${fmtMin(hora.avgIntervalMin)}, ${hora.avgDurationSec != null ? Math.round(hora.avgDurationSec) + ' s' : '—'}`,
      )
    }
    out.push('', 'Data/hora · usuário · duração · intervalo')
    for (const l of linhas)
      out.push(`${fmtData(l.c.inicio)} · ${l.dono} · ${durSec(l.c)} s · ${l.intervalo != null ? fmtMin(l.intervalo) : '—'}`)
    return out.join('\n')
  }

  const aviso = (m: string) => {
    setMsg(m)
    setTimeout(() => setMsg(null), 2500)
  }

  const compartilhar = async () => {
    const t = texto()
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Histórico de contrações', text: t })
        return
      } catch {
        /* cancelled or blocked: fall back to copying */
      }
    }
    try {
      await navigator.clipboard.writeText(t)
      aviso('Histórico copiado. Cole onde quiser enviar.')
    } catch {
      aviso('Não foi possível compartilhar neste navegador.')
    }
  }

  const exportarCsv = () => {
    const rows = [['data_hora', 'usuario', 'parto', 'duracao_s', 'intervalo_min']]
    for (const l of linhas)
      rows.push([
        new Date(l.c.inicio).toISOString(),
        l.dono,
        l.parto.nome,
        String(durSec(l.c)),
        l.intervalo != null ? l.intervalo.toFixed(1) : '',
      ])
    const csv = rows.map((r) => r.map((v) => `"${v.replaceAll('"', '""')}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `dule-contracoes-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 5000)
  }

  if (vendo)
    return (
      <div className="viewer">
        <div className="viewer-bar">
          <span>
            <span className="live-dot" aria-hidden /> Vendo a tela de <b>{vendo.nome}</b> · ao vivo
          </span>
          <button onClick={() => setVendo(null)}>Voltar</button>
        </div>
        <div className="viewer-body">
          <StoreProvider key={vendo.id} usuario={vendo} onLogout={() => setVendo(null)} readOnly>
            <App />
          </StoreProvider>
        </div>
      </div>
    )

  return (
    <div className="screen admin">
      <header className="screen-head">
        <span />
        <h1>Admin</h1>
        <button className="icon-btn admin-exit" onClick={onLogout} aria-label="Sair">
          Sair
        </button>
      </header>

      <div className="segmented admin-tabs" role="tablist">
        <button role="tab" aria-selected={aba === 'dashboard'} className={aba === 'dashboard' ? 'sel' : ''} onClick={() => setAba('dashboard')}>
          Dashboard
        </button>
        <button role="tab" aria-selected={aba === 'historico'} className={aba === 'historico' ? 'sel' : ''} onClick={() => setAba('historico')}>
          Histórico
        </button>
        <button role="tab" aria-selected={aba === 'tela'} className={aba === 'tela' ? 'sel' : ''} onClick={() => setAba('tela')}>
          Tela do usuário
        </button>
      </div>
      <p className="admin-live">
        <span className="live-dot" aria-hidden /> {nuvem ? 'Ao vivo · nuvem' : 'Só este celular'}
        {atualizado ? ` · atualizado às ${fmtClock(atualizado)}` : ''}
      </p>
      {!nuvem && (
        <p className="admin-aviso">Sem conexão com a nuvem: mostrando só os dados deste celular. Entre de novo com internet.</p>
      )}
      {nuvem && liberado === false && (
        <p className="admin-aviso">
          A conta admin ainda não foi liberada na nuvem, então só aparecem os dados deste celular. Rode o passo 2 do SQL no
          Supabase e atualize esta tela.
        </p>
      )}

      {aba !== 'tela' && (
        <label className="admin-filter">
          <span>Usuário</span>
          <select id="admin-filtro" className="field" value={filtro} onChange={(e) => setFiltro(e.target.value)}>
            <option value="todos">Todos</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome}
              </option>
            ))}
          </select>
        </label>
      )}

      {aba === 'tela' ? (
        <div className="admin-users">
          <p className="hint pad">Escolha um usuário para ver a tela dele, do jeito que ele vê, atualizada ao vivo.</p>
          {users.length === 0 && <p className="hint pad">Nenhum usuário cadastrado neste celular.</p>}
          {users.map((u) => {
            const ps = partos.filter((p) => p.userId === u.id)
            const n = events.filter((e) => e.tipo === 'contracao' && ps.some((p) => p.id === e.partoId)).length
            const rodando = (() => {
              try {
                return localStorage.getItem(`dule.running:${u.id}`) != null
              } catch {
                return false
              }
            })()
            return (
              <button key={u.id} className="option admin-user" onClick={() => setVendo(u)}>
                <span>
                  <b>{u.nome}</b>
                  <small>
                    {' '}
                    · {n} {n === 1 ? 'contração' : 'contrações'}
                  </small>
                </span>
                {rodando && <span className="admin-fase">contração agora</span>}
              </button>
            )
          })}
        </div>
      ) : aba === 'dashboard' ? (
        <>
          <div className="admin-kpis">
            <div className="kpi">
              <b>{filtro === 'todos' ? users.length : 1}</b>
              <small>usuários</small>
            </div>
            <div className="kpi">
              <b>{partosVisiveis.length}</b>
              <small>partos</small>
            </div>
            <div className="kpi">
              <b>{linhas.length}</b>
              <small>contrações</small>
            </div>
            <div className="kpi">
              <b>{total24h}</b>
              <small>últimas 24 h</small>
            </div>
          </div>

          {porParto.length === 0 && <p className="hint pad">Nenhum parto registrado ainda.</p>}
          {porParto.map(({ p, cs, hora, fase, barras }) => {
            const max = Math.max(1, ...barras)
            const ultima = cs.at(-1)
            return (
              <section key={p.id} className="card admin-parto">
                <div className="admin-parto-head">
                  <div>
                    <h2>{nomeDe(p.userId)}</h2>
                    <small>{p.nome}</small>
                  </div>
                  <span className="admin-fase">{fase ? phaseById(fase).curto : 'Sem contrações'}</span>
                </div>
                {users.find((u) => u.id === p.userId) && (
                  <button className="admin-ver" onClick={() => setVendo(users.find((u) => u.id === p.userId)!)}>
                    Ver tela de {nomeDe(p.userId)} →
                  </button>
                )}
                <div className="admin-stats">
                  <div>
                    <b>{cs.length}</b>
                    <small>contrações</small>
                  </div>
                  <div>
                    <b>{fmtMin(hora.avgIntervalMin)}</b>
                    <small>intervalo 1 h</small>
                  </div>
                  <div>
                    <b>{hora.avgDurationSec != null ? `${Math.round(hora.avgDurationSec)} s` : '—'}</b>
                    <small>duração 1 h</small>
                  </div>
                  <div>
                    <b>{ultima ? fmtAgo(ultima.inicio, now) : '—'}</b>
                    <small>última</small>
                  </div>
                </div>
                <figure className="admin-bars" aria-label="Contrações por hora nas últimas 6 horas">
                  {barras.map((n, i) => (
                    <div key={i} className="admin-bar">
                      <span style={{ height: `${(n / max) * 100}%` }} />
                      <small>{n}</small>
                    </div>
                  ))}
                  <figcaption>Contrações por hora · últimas 6 h</figcaption>
                </figure>
              </section>
            )
          })}
        </>
      ) : (
        <div className="admin-table-wrap">
          {linhas.length === 0 ? (
            <p className="hint pad">Nenhuma contração registrada.</p>
          ) : (
            <table className="ctable admin-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Usuário</th>
                  <th>Duração</th>
                  <th>Intervalo</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.c.id}>
                    <td>
                      {new Date(l.c.inicio).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} <b>{fmtClock(l.c.inicio)}</b>
                    </td>
                    <td>
                      {l.dono}
                      <small>{l.parto.nome}</small>
                    </td>
                    <td>{durSec(l.c)} s</td>
                    <td>{l.intervalo != null ? fmtMin(l.intervalo) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {aba !== 'tela' && (
        <div className="report-actions">
          <button className="primary" onClick={compartilhar}>
            Compartilhar
          </button>
          <button onClick={exportarCsv}>Exportar CSV</button>
        </div>
      )}
      {msg && <p className="hint pad">{msg}</p>}
    </div>
  )
}

import { useRef, useState } from 'react'
import { useStore } from '../store'
import { exportBackup, importBackup, uid } from '../db'
import type { Settings as S } from '../types'

export function Settings({ onBack }: { onBack: () => void }) {
  const { settings, setSettings, partos, parto, events, newParto, switchParto, resetParto, reload } = useStore()
  const [novo, setNovo] = useState('')
  const [atalho, setAtalho] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [resetMsg, setResetMsg] = useState<string | null>(null)
  const file = useRef<HTMLInputElement>(null)

  const patch = (p: Partial<S>) => setSettings({ ...settings, ...p })
  const num = (v: string, fallback: number) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : fallback)

  const move = (i: number, d: -1 | 1) => {
    const xs = [...settings.atalhos]
    const j = i + d
    if (j < 0 || j >= xs.length) return
    ;[xs[i], xs[j]] = [xs[j], xs[i]]
    patch({ atalhos: xs })
  }

  const doExport = async () => {
    const blob = await exportBackup()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `dule-backup-${new Date().toISOString().slice(0, 16).replace(':', 'h')}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 5000)
  }
  const doImport = async (f: File) => {
    try {
      await importBackup(f)
      await reload()
      setMsg('Backup importado.')
    } catch (e) {
      setMsg(`Erro: ${(e as Error).message}`)
    }
  }

  return (
    <div className="screen">
      <header className="screen-head">
        <button className="icon-btn" onClick={onBack} aria-label="Voltar">
          ←
        </button>
        <h1>Configurações</h1>
        <span />
      </header>

      <section className="card">
        <h2>Aparência</h2>
        <div className="option-list">
          <button className={`option ${settings.tema !== 'escuro' ? 'sel' : ''}`} onClick={() => patch({ tema: 'claro' })}>
            ☀️ Claro
          </button>
          <button className={`option ${settings.tema === 'escuro' ? 'sel' : ''}`} onClick={() => patch({ tema: 'escuro' })}>
            🌙 Escuro <small>· bom para o quarto com pouca luz</small>
          </button>
        </div>
      </section>

      <section className="card">
        <h2>Parto</h2>
        <p className="hint">Crie um parto de teste para ensaiar antes do dia. Cada parto tem seu próprio histórico.</p>
        <div className="option-list">
          {partos.map((p) => (
            <button key={p.id} className={`option ${p.id === parto.id ? 'sel' : ''}`} onClick={() => switchParto(p.id)}>
              {p.nome} <small>· criado {new Date(p.criadoEm).toLocaleDateString('pt-BR')}</small>
            </button>
          ))}
        </div>
        <div className="row">
          <input className="field" placeholder="Nome (ex.: Ensaio)" value={novo} onChange={(e) => setNovo(e.target.value)} />
          <button
            onClick={() => {
              if (novo.trim()) newParto(novo.trim())
              setNovo('')
            }}
          >
            Criar
          </button>
        </div>
      </section>

      <section className="card">
        <h2>Alerta para ligar para a maternidade</h2>
        <p className="hint">Padrão 5-1-1. Confirme com a obstetra o critério de vocês.</p>
        <div className="row3">
          <label>
            a cada ≤ (min)
            <input
              className="field"
              type="number"
              inputMode="decimal"
              value={settings.alerta.intervaloMin}
              onChange={(e) => patch({ alerta: { ...settings.alerta, intervaloMin: num(e.target.value, 5) } })}
            />
          </label>
          <label>
            durando (s)
            <input
              className="field"
              type="number"
              inputMode="numeric"
              value={settings.alerta.duracaoSeg}
              onChange={(e) => patch({ alerta: { ...settings.alerta, duracaoSeg: num(e.target.value, 60) } })}
            />
          </label>
          <label>
            por (min)
            <input
              className="field"
              type="number"
              inputMode="numeric"
              value={settings.alerta.janelaMin}
              onChange={(e) => patch({ alerta: { ...settings.alerta, janelaMin: num(e.target.value, 60) } })}
            />
          </label>
        </div>
      </section>

      <section className="card">
        <h2>Lembretes</h2>
        <label className="toggle">
          <input
            type="checkbox"
            checked={settings.lembretes.dorAtivo}
            onChange={(e) => patch({ lembretes: { ...settings.lembretes, dorAtivo: e.target.checked } })}
          />
          Perguntar a dor a cada
          <input
            className="field tiny"
            type="number"
            value={settings.lembretes.dorMin}
            onChange={(e) => patch({ lembretes: { ...settings.lembretes, dorMin: num(e.target.value, 30) } })}
          />
          min ou
          <input
            className="field tiny"
            type="number"
            value={settings.lembretes.dorContracoes}
            onChange={(e) => patch({ lembretes: { ...settings.lembretes, dorContracoes: num(e.target.value, 5) } })}
          />
          contrações
        </label>
        <label className="toggle">
          <input
            type="checkbox"
            checked={settings.lembretes.humorAtivo}
            onChange={(e) => patch({ lembretes: { ...settings.lembretes, humorAtivo: e.target.checked } })}
          />
          Perguntar o humor a cada
          <input
            className="field tiny"
            type="number"
            value={settings.lembretes.humorMin}
            onChange={(e) => patch({ lembretes: { ...settings.lembretes, humorMin: num(e.target.value, 60) } })}
          />
          min
        </label>
      </section>

      <section className="card">
        <h2>Atalhos</h2>
        <ul className="shortcut-list">
          {settings.atalhos.map((a, i) => (
            <li key={a.id}>
              <span>{a.rotulo}</span>
              <button className="icon-btn" onClick={() => move(i, -1)} aria-label="Subir">
                ↑
              </button>
              <button className="icon-btn" onClick={() => move(i, 1)} aria-label="Descer">
                ↓
              </button>
              {a.kind === 'custom' && (
                <button
                  className="icon-btn"
                  onClick={() => patch({ atalhos: settings.atalhos.filter((x) => x.id !== a.id) })}
                  aria-label="Remover"
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
        <div className="row">
          <input className="field" placeholder="Novo atalho (ex.: Vomitou)" value={atalho} onChange={(e) => setAtalho(e.target.value)} />
          <button
            onClick={() => {
              if (!atalho.trim()) return
              patch({ atalhos: [...settings.atalhos, { id: uid(), kind: 'custom', rotulo: atalho.trim() }] })
              setAtalho('')
            }}
          >
            Adicionar
          </button>
        </div>
      </section>

      <section className="card">
        <h2>Backup</h2>
        <p className="hint">Os dados ficam só neste celular. Exporte um backup (inclui os áudios) para não perder nada.</p>
        <div className="row">
          <button onClick={doExport}>Exportar</button>
          <button onClick={() => file.current?.click()}>Importar</button>
          <input
            ref={file}
            type="file"
            accept="application/json"
            hidden
            onChange={(e) => e.target.files?.[0] && doImport(e.target.files[0])}
          />
        </div>
        {msg && <p className="hint">{msg}</p>}
      </section>

      <section className="card">
        <h2>Zerar</h2>
        <p className="hint">
          Apaga todos os registros de <b>{parto.nome}</b> (contrações, notas, áudios, dor, humor e fase) e começa do zero.
          Configurações e atalhos continuam. Não dá para desfazer: exporte um backup antes se quiser guardar.
        </p>
        {!confirmReset ? (
          <button className="danger-btn" onClick={() => { setResetMsg(null); setConfirmReset(true) }}>
            Zerar
          </button>
        ) : (
          <div className="confirm-box" role="alert">
            <p>
              Apagar {events.length} {events.length === 1 ? 'registro' : 'registros'} de {parto.nome}?
            </p>
            <div className="row">
              <button onClick={() => setConfirmReset(false)}>Cancelar</button>
              <button
                className="danger-btn"
                onClick={async () => {
                  await resetParto()
                  setConfirmReset(false)
                  setResetMsg('Tudo zerado. Pode começar de novo.')
                }}
              >
                Sim, zerar
              </button>
            </div>
          </div>
        )}
        {resetMsg && <p className="hint">{resetMsg}</p>}
      </section>

      <p className="hint pad">
        O Dule.app não substitui a orientação da equipe médica. As fases e recomendações são sugestões gerais.
      </p>
    </div>
  )
}

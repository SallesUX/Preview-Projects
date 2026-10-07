import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { buildReport, currentPhase, describe, fmtClock, reportText } from '../logic'
import { moodByValue, painColor } from '../content'
import { AudioPlayer } from './Chat'

const PERIODS: { label: string; min: number | null }[] = [
  { label: '1 h', min: 60 },
  { label: '3 h', min: 180 },
  { label: '6 h', min: 360 },
  { label: 'Tudo', min: null },
]

export function Report({ onBack }: { onBack: () => void }) {
  const { events, now, parto } = useStore()
  const [periodo, setPeriodo] = useState<number | null>(60)
  const [grande, setGrande] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const phase = currentPhase(events, now, parto.faseManual)
  const r = useMemo(() => buildReport(events, now, periodo, phase), [events, now, periodo, phase])
  const text = () => reportText(r, parto.nome, now)

  const share = async () => {
    const t = text()
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Relatório do parto', text: t })
        return
      } catch {
        /* cancelled */
      }
    } else copy()
  }
  const copy = async () => {
    await navigator.clipboard.writeText(text())
    setMsg('Copiado!')
    setTimeout(() => setMsg(null), 2000)
  }

  const humorUlt = r.humor.ultimo ? moodByValue(Number(r.humor.ultimo.valor)) : undefined

  return (
    <div className={`screen report ${grande ? 'big' : ''}`}>
      <header className="screen-head no-print">
        <button className="icon-btn" onClick={onBack} aria-label="Voltar">
          ←
        </button>
        <h1>Relatório</h1>
        <span />
      </header>

      <div className="segmented no-print" role="tablist">
        {PERIODS.map((p) => (
          <button key={p.label} className={periodo === p.min ? 'sel' : ''} onClick={() => setPeriodo(p.min)}>
            {p.label}
          </button>
        ))}
      </div>

      <p className="resumo">{r.resumo}</p>

      {r.marcos.length > 0 && (
        <Section title="Marcos">
          <ul>
            {r.marcos.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Contrações">
        <div className="kpis">
          <Kpi v={String(r.contr.count)} l="no período" />
          <Kpi v={r.contr.avgI} l="intervalo médio" />
          <Kpi v={r.contr.avgD} l="duração média" />
          <Kpi v={r.contr.trend ?? '—'} l="tendência" />
        </div>
      </Section>

      <Section title="Dor e humor">
        <div className="kpis">
          <Kpi
            v={r.dor.ultimo ? `${r.dor.ultimo.valor}/10` : '—'}
            l={r.dor.ultimo ? `dor às ${fmtClock(r.dor.ultimo.inicio)}` : 'dor'}
          />
          <Kpi v={r.dor.max != null ? `${r.dor.max}/10` : '—'} l="dor máxima" />
          <Kpi v={humorUlt ? `${humorUlt.emoji}` : '—'} l={humorUlt ? humorUlt.nome : 'humor'} />
        </div>
        <PainMoodChart dor={r.dor.pontos} humor={r.humor.pontos} />
      </Section>

      <Section title="Última vez">
        <ul>
          {r.ultimos.map((u) => (
            <li key={u.rotulo}>
              <b>{u.rotulo}:</b> {u.quando}
            </li>
          ))}
        </ul>
      </Section>

      <Section title={`Notas e áudios (${r.notas.length})`}>
        {r.notas.length === 0 && <p className="hint">Nada no período.</p>}
        <ul className="notes">
          {r.notas.map((n) => (
            <li key={n.id}>
              <time>{fmtClock(n.inicio)}</time> {describe(n)}
              {n.audioId && (
                <div className="no-print">
                  <AudioPlayer audioId={n.audioId} />
                </div>
              )}
            </li>
          ))}
        </ul>
      </Section>

      <div className="report-actions no-print">
        <button className="primary" onClick={share}>
          Compartilhar
        </button>
        <button onClick={copy}>{msg ?? 'Copiar'}</button>
        <button onClick={() => setGrande((g) => !g)}>{grande ? 'Letra normal' : 'Letra grande'}</button>
        <button onClick={() => window.print()}>PDF</button>
      </div>
    </div>
  )
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="card">
    <h2>{title}</h2>
    {children}
  </section>
)
const Kpi = ({ v, l }: { v: string; l: string }) => (
  <div className="kpi">
    <b>{v}</b>
    <small>{l}</small>
  </div>
)

/** Pain (0–10 line) and mood (emoji on a 1–5 scale) sharing one time axis. */
function PainMoodChart({ dor, humor }: { dor: { t: number; v: number }[]; humor: { t: number; v: number }[] }) {
  const all = [...dor, ...humor]
  if (all.length === 0) return <p className="hint">Sem registros de dor ou humor no período.</p>
  const W = 340,
    H = 180,
    L = 28,
    R = 12,
    T = 14,
    B = 26
  const t0 = Math.min(...all.map((p) => p.t))
  const t1 = Math.max(...all.map((p) => p.t))
  const span = Math.max(t1 - t0, 60_000)
  const x = (t: number) => L + ((t - t0) / span) * (W - L - R)
  const yPain = (v: number) => T + (1 - v / 10) * (H - T - B)
  const yMood = (v: number) => T + (1 - (v - 1) / 4) * (H - T - B)
  const path = dor.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)} ${yPain(p.v).toFixed(1)}`).join('')
  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Dor e humor ao longo do tempo">
        {[0, 5, 10].map((g) => (
          <g key={g}>
            <line x1={L} x2={W - R} y1={yPain(g)} y2={yPain(g)} className="grid" />
            <text x={L - 6} y={yPain(g) + 4} textAnchor="end" className="axis">
              {g}
            </text>
          </g>
        ))}
        <text x={L} y={H - 6} className="axis">
          {fmtClock(t0)}
        </text>
        <text x={W - R} y={H - 6} textAnchor="end" className="axis">
          {fmtClock(t1)}
        </text>
        {dor.length > 1 && <path d={path} className="pain-line" />}
        {dor.map((p) => (
          <circle key={`d${p.t}`} cx={x(p.t)} cy={yPain(p.v)} r="5" fill={painColor(p.v)} />
        ))}
        {humor.map((p) => (
          <text key={`h${p.t}`} x={x(p.t)} y={yMood(p.v) + 6} textAnchor="middle" fontSize="16">
            {moodByValue(p.v)?.emoji}
          </text>
        ))}
      </svg>
      <figcaption>Linha: dor (0–10). Emojis: humor (😫 embaixo, 😄 em cima).</figcaption>
    </figure>
  )
}

import { useMemo } from 'react'
import { useStore } from '../store'
import { contractions, durSec, fmtClock, fmtMin } from '../logic'
import type { DuleEvent } from '../types'

export function ContractionsList({ onBack, onEdit }: { onBack: () => void; onEdit: (e: DuleEvent) => void }) {
  const { events } = useStore()
  const cs = useMemo(() => contractions(events), [events])
  const rows = cs.map((c, i) => ({ c, interval: i ? (c.inicio - cs[i - 1].inicio) / 60_000 : null })).reverse()
  return (
    <div className="screen">
      <header className="screen-head">
        <button className="icon-btn" onClick={onBack} aria-label="Voltar">
          ←
        </button>
        <h1>Contrações ({cs.length})</h1>
        <span />
      </header>
      {rows.length === 0 ? (
        <p className="hint pad">Nenhuma contração registrada ainda.</p>
      ) : (
        <table className="ctable">
          <thead>
            <tr>
              <th>Início</th>
              <th>Duração</th>
              <th>Intervalo</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ c, interval }) => (
              <tr key={c.id} onClick={() => onEdit(c)}>
                <td>{fmtClock(c.inicio)}</td>
                <td>{durSec(c)} s</td>
                <td>{interval != null ? fmtMin(interval) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="hint pad">Toque numa linha para corrigir o horário ou apagar.</p>
    </div>
  )
}

import { useMemo } from 'react'
import { useStore } from '../store'
import { contractions, durSec, fmtMMSS, fmtMin, fmtSeg, inWindow, statsFor } from '../logic'

export function Timer({ onStopped }: { onStopped: () => void }) {
  const { running, now, events, startContraction, stopContraction, cancelContraction, readOnly } = useStore()
  const cs = useMemo(() => contractions(events), [events])
  const last = cs.at(-1)
  const prev = cs.at(-2)
  const hour = useMemo(() => statsFor(inWindow(cs, now, 60)), [cs, now])
  const sinceLast = last ? (now - last.inicio) / 60_000 : null

  const toggle = async () => {
    if (running) {
      await stopContraction()
      onStopped()
    } else startContraction()
  }

  return (
    <section className="timer">
      <button className={`timer-btn ${running ? 'running' : ''}`} onClick={toggle} disabled={readOnly}>
        {running ? (
          <>
            <span className="timer-label">Terminou</span>
            <span className="timer-secs">{fmtMMSS((now - running) / 1000)}</span>
          </>
        ) : (
          <>
            <span className="timer-label">Começou</span>
            <span className="timer-sub">
              {sinceLast != null
                ? `última há ${fmtMin(sinceLast)}`
                : readOnly
                  ? 'nenhuma contração ainda'
                  : 'toque quando a contração começar'}
            </span>
          </>
        )}
      </button>
      {running && !readOnly && (
        <button className="link-btn" onClick={cancelContraction}>
          Toquei sem querer — cancelar
        </button>
      )}
      <div className="timer-stats">
        <div>
          <b>{last ? fmtSeg(durSec(last)) : '—'}</b>
          <small>última duração</small>
        </div>
        <div>
          <b>{last && prev ? fmtMin((last.inicio - prev.inicio) / 60_000) : '—'}</b>
          <small>último intervalo</small>
        </div>
        <div>
          <b>{fmtMin(hour.avgIntervalMin)}</b>
          <small>intervalo médio 1 h</small>
        </div>
        <div>
          <b>{fmtSeg(hour.avgDurationSec)}</b>
          <small>duração média · {hour.count}×</small>
        </div>
      </div>
    </section>
  )
}

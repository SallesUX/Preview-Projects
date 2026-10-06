import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../store'
import { ALERTA_RODAPE, APOIO_EMOCIONAL, GUIA_AVISO, PHASES, phaseById } from '../content'
import type { PhaseId } from '../types'
import { MIN, currentPhase, lastOf } from '../logic'

export function PhaseWindow({ onPick }: { onPick: () => void }) {
  const { events, now, parto } = useStore()
  const phaseId = useMemo(() => currentPhase(events, now, parto.faseManual), [events, now, parto.faseManual])
  const idx = phaseId ? PHASES.findIndex((p) => p.id === phaseId) : -1
  const phase = phaseId ? phaseById(phaseId) : null
  const [guideOpen, setGuideOpen] = useState(false)

  const dor = lastOf(events, 'dor')
  const humor = lastOf(events, 'humor')
  const dorRecente = dor && now - dor.inicio < 30 * MIN ? Number(dor.valor) : null
  const humorRecente = humor && now - humor.inicio < 60 * MIN ? Number(humor.valor) : null

  // mood ≤ 2 for more than 1 h, outside transition
  const humorBaixoLongo = useMemo(() => {
    if (phaseId === 'transicao') return false
    const hs = events.filter((e) => e.atalho === 'humor')
    if (!hs.length || Number(hs.at(-1)!.valor) > 2) return false
    let firstLow = hs.at(-1)!.inicio
    for (let i = hs.length - 1; i >= 0 && Number(hs[i].valor) <= 2; i--) firstLow = hs[i].inicio
    return now - firstLow > 60 * MIN
  }, [events, now, phaseId])

  return (
    <section className="phase">
      <div className="phase-top">
        <button className="phase-head" onClick={onPick}>
          <small>FASE ATUAL {parto.faseManual ? '(escolhida)' : '(sugerida)'} · toque para mudar</small>
          <strong>{phase ? phase.nome : 'Aguardando contrações'}</strong>
        </button>
        <button className="help-btn" onClick={() => setGuideOpen(true)} aria-label="Sobre as fases do trabalho de parto">
          ?
        </button>
      </div>
      <PhaseGuide open={guideOpen} onClose={() => setGuideOpen(false)} current={phaseId} />

      <div className="phase-bar" aria-hidden>
        {PHASES.map((p, i) => (
          <div key={p.id} className="phase-step">
            <span className={`seg ${i < idx ? 'past' : i === idx ? 'now' : ''}`} />
            <span className={`seg-label ${i === idx ? 'now' : ''}`}>{p.curto}</span>
          </div>
        ))}
      </div>

      {phase ? (
        <>
          <p className="phase-now">{phase.acontecendo}</p>
          <h3>Recomendação para agora</h3>
          <ul className="recs">
            {phase.recomendacoes.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </>
      ) : (
        <p className="phase-now">Use o botão "Começou" a cada contração. A fase será sugerida a partir da última hora.</p>
      )}

      {dorRecente != null && dorRecente >= 7 && phase && phase.alivio.length > 0 && (
        <div className="extra">
          <h3>Alívio para a dor {dorRecente}/10</h3>
          <ul className="recs">
            {phase.alivio.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          {dorRecente >= 9 && <p>Ela pode pedir analgesia à equipe, se fizer parte do plano dela.</p>}
        </div>
      )}

      {humorRecente != null && humorRecente <= 2 && (
        <div className="extra">
          {phaseId === 'transicao' ? (
            <p>Sensação de não aguentar é comum agora e costuma indicar que o bebê está perto.</p>
          ) : (
            <>
              <h3>Apoio emocional</h3>
              <ul className="recs">
                {APOIO_EMOCIONAL.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </>
          )}
          {humorBaixoLongo && <p>Humor baixo há mais de 1 h: converse com a equipe sobre conforto e analgesia.</p>}
        </div>
      )}

      <p className="danger-strip">{ALERTA_RODAPE}</p>
    </section>
  )
}

function PhaseGuide({ open, onClose, current }: { open: boolean; onClose: () => void; current: PhaseId | null }) {
  useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="pop-backdrop" onClick={onClose}>
      <div className="pop" role="dialog" aria-modal="true" aria-label="Fases" onClick={(e) => e.stopPropagation()}>
        <div className="pop-head">
          <h2>Fases</h2>
          <button className="pop-close" onClick={onClose} aria-label="Fechar">
            ✕
          </button>
        </div>
        <dl className="pop-list">
          {PHASES.map((p) => (
            <div key={p.id} className={p.id === current ? 'now' : ''}>
              <dt>{p.curto}</dt>
              <dd>
                {p.guia.contracoes}
                <span>{p.guia.duracao}</span>
              </dd>
            </div>
          ))}
        </dl>
        <p className="pop-foot">{GUIA_AVISO}</p>
      </div>
    </div>
  )
}

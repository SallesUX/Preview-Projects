import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import { db } from '../db'
import { describe, durSec, fmtClock } from '../logic'
import { moodByValue, painColor } from '../content'
import type { DuleEvent } from '../types'

export function AudioPlayer({ audioId }: { audioId: string }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let u: string | null = null
    db.getAudio(audioId).then((b) => {
      if (b) {
        u = URL.createObjectURL(b)
        setUrl(u)
      }
    })
    return () => {
      if (u) URL.revokeObjectURL(u)
    }
  }, [audioId])
  return url ? <audio controls src={url} preload="metadata" /> : <small>carregando áudio…</small>
}

const dayKey = (t: number) => new Date(t).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })

export function Chat({ onEdit }: { onEdit: (e: DuleEvent) => void }) {
  const { events } = useStore()
  const end = useRef<HTMLDivElement>(null)
  const count = events.length
  const prev = useRef(count)
  // scroll to the newest item only when something was added (not on first load,
  // so the phase window and alerts stay in view when the app opens)
  useEffect(() => {
    if (count > prev.current) end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    prev.current = count
  }, [count])

  if (!events.length)
    return (
      <section className="chat empty">
        <p>As notas, áudios e contrações aparecem aqui, em ordem.</p>
        <p>Escreva, segure o microfone para gravar ou use os atalhos abaixo.</p>
      </section>
    )

  let lastDay = ''
  return (
    <section className="chat" aria-label="Linha do tempo">
      {events.map((e) => {
        const d = dayKey(e.inicio)
        const sep = d !== lastDay ? <div className="day-sep">{d}</div> : null
        lastDay = d
        return (
          <div key={e.id}>
            {sep}
            {e.tipo === 'contracao' ? (
              <button className="pill" onClick={() => onEdit(e)}>
                ⏱ {fmtClock(e.inicio)} · contração de {durSec(e)} s
              </button>
            ) : (
              <button className={`bubble ${bubbleClass(e)}`} onClick={() => onEdit(e)}>
                <BubbleBody e={e} />
                <time>{fmtClock(e.inicio)}</time>
              </button>
            )}
          </div>
        )
      })}
      <div ref={end} />
    </section>
  )
}

function bubbleClass(e: DuleEvent) {
  if (e.atalho === 'bolsa' && e.valor !== 'claro') return 'alert'
  if (e.tipo === 'atalho') return 'quick'
  return ''
}

function BubbleBody({ e }: { e: DuleEvent }) {
  if (e.atalho === 'dor') {
    const v = Number(e.valor)
    return (
      <span>
        <span className="dot" style={{ background: painColor(v) }} /> {describe(e)}
      </span>
    )
  }
  if (e.atalho === 'humor') {
    const m = moodByValue(Number(e.valor))
    return (
      <span>
        <span className="big-emoji">{m?.emoji}</span> {describe(e).replace(m?.emoji ?? '', '').trim()}
      </span>
    )
  }
  if (e.tipo === 'audio')
    return (
      <span className="audio-bubble" onClick={(ev) => ev.stopPropagation()}>
        {e.audioId && <AudioPlayer audioId={e.audioId} />}
        {e.texto && <span className="transcript">"{e.texto}"</span>}
      </span>
    )
  return <span>{describe(e)}</span>
}

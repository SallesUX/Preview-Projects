import { useEffect, useState } from 'react'
import { Sheet, fromLocalInput, toLocalInput } from './Sheet'
import { useStore } from '../store'
import { MOODS, MOOD_TAGS, PAIN_BANDS, PHASES, painBand, painColor } from '../content'
import { describe, suggestPhase } from '../logic'
import type { DuleEvent, PhaseId, ShortcutKind } from '../types'

// ---------- Pain 0–10 ----------
export function PainSheet({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved?: () => void }) {
  const { addEvent } = useStore()
  const [v, setV] = useState<number | null>(null)
  const [local, setLocal] = useState<string | null>(null)
  const [lidando, setLidando] = useState<boolean | null>(null)
  const [nota, setNota] = useState('')
  useEffect(() => {
    if (open) {
      setV(null)
      setLocal(null)
      setLidando(null)
      setNota('')
    }
  }, [open])

  const save = async () => {
    if (v == null) return
    await addEvent({
      tipo: 'atalho',
      atalho: 'dor',
      inicio: Date.now(),
      valor: v,
      local: local ?? undefined,
      lidando: lidando ?? undefined,
      texto: nota.trim() || undefined,
    })
    onClose()
    onSaved?.()
  }

  return (
    <Sheet open={open} onClose={onClose} title="De 0 a 10, quanto está doendo?" full>
      <p className="hint">Pergunte no intervalo, não durante a contração.</p>
      <div className="pain-grid">
        {Array.from({ length: 11 }, (_, i) => (
          <button
            key={i}
            className={`pain-btn ${v === i ? 'sel' : ''}`}
            style={{ background: painColor(i) }}
            onClick={() => setV(i)}
            aria-label={`Dor ${i}`}
          >
            {i}
          </button>
        ))}
      </div>
      <div className="pain-legend">
        {PAIN_BANDS.map((b) => (
          <span key={b.nome}>
            <b>{b.min === b.max ? b.min : `${b.min}–${b.max}`}</b> {b.nome}
          </span>
        ))}
      </div>
      {v != null && (
        <>
          <p className="picked">
            <b>{v}</b> · {painBand(v).nome} — {painBand(v).desc}
          </p>
          <Label>Onde dói? (opcional)</Label>
          <Chips options={['Barriga', 'Lombar', 'Outro']} value={local} onChange={setLocal} />
          <Label>Está conseguindo lidar? (opcional)</Label>
          <Chips
            options={['Sim', 'Não']}
            value={lidando == null ? null : lidando ? 'Sim' : 'Não'}
            onChange={(x) => setLidando(x == null ? null : x === 'Sim')}
          />
          <input className="field" placeholder="Nota (opcional)" value={nota} onChange={(e) => setNota(e.target.value)} />
          <button className="primary" onClick={save}>
            Registrar dor {v}
          </button>
        </>
      )}
    </Sheet>
  )
}

// ---------- Mood 1–5 ----------
export function MoodSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { addEvent } = useStore()
  const [v, setV] = useState<number | null>(null)
  const [tags, setTags] = useState<string[]>([])
  useEffect(() => {
    if (open) {
      setV(null)
      setTags([])
    }
  }, [open])
  const save = async () => {
    if (v == null) return
    await addEvent({ tipo: 'atalho', atalho: 'humor', inicio: Date.now(), valor: v, tags: tags.length ? tags : undefined })
    onClose()
  }
  return (
    <Sheet open={open} onClose={onClose} title="Como você está se sentindo?" full>
      <div className="mood-grid">
        {MOODS.map((m) => (
          <button key={m.valor} className={`mood-btn ${v === m.valor ? 'sel' : ''}`} onClick={() => setV(m.valor)}>
            <span className="mood-emoji">{m.emoji}</span>
            <span className="mood-name">{m.nome}</span>
            <small>{m.desc}</small>
          </button>
        ))}
      </div>
      {v != null && (
        <>
          <Label>Palavras rápidas (opcional)</Label>
          <div className="chips">
            {MOOD_TAGS.map((t) => (
              <button
                key={t}
                className={`chip ${tags.includes(t) ? 'sel' : ''}`}
                onClick={() => setTags((xs) => (xs.includes(t) ? xs.filter((x) => x !== t) : [...xs, t]))}
              >
                {t}
              </button>
            ))}
          </div>
          <button className="primary" onClick={save}>
            Registrar humor
          </button>
        </>
      )}
    </Sheet>
  )
}

// ---------- Generic: options and/or optional text ----------
export interface OptionsConfig {
  kind: ShortcutKind
  title: string
  options?: string[]
  textPlaceholder?: string
}
export function OptionsSheet({ config, onClose }: { config: OptionsConfig | null; onClose: () => void }) {
  const { addEvent } = useStore()
  const [txt, setTxt] = useState('')
  useEffect(() => setTxt(''), [config])
  if (!config) return null
  const save = async (valor?: string) => {
    await addEvent({
      tipo: 'atalho',
      atalho: config.kind,
      inicio: Date.now(),
      valor,
      texto: txt.trim() || undefined,
    })
    onClose()
  }
  return (
    <Sheet open onClose={onClose} title={config.title}>
      {config.options ? (
        <div className="option-list">
          {config.options.map((o) => (
            <button key={o} className="option" onClick={() => save(o.toLowerCase())}>
              {o}
            </button>
          ))}
        </div>
      ) : (
        <>
          <input
            className="field"
            autoFocus
            placeholder={config.textPlaceholder}
            value={txt}
            onChange={(e) => setTxt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
          />
          <button className="primary" onClick={() => save()}>
            Registrar
          </button>
        </>
      )}
    </Sheet>
  )
}

// ---------- Phase picker ----------
export function PhasePicker({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { parto, setFaseManual, events, now } = useStore()
  const sug = suggestPhase(events, now)
  const pick = async (f: PhaseId | null) => {
    await setFaseManual(f)
    onClose()
  }
  return (
    <Sheet open={open} onClose={onClose} title="Em que fase vocês estão?">
      <div className="option-list">
        <button className={`option ${parto.faseManual == null ? 'sel' : ''}`} onClick={() => pick(null)}>
          Automático (pelo cronômetro){sug ? ` — agora: ${PHASES.find((p) => p.id === sug)!.curto}` : ''}
        </button>
        {PHASES.map((p) => (
          <button key={p.id} className={`option ${parto.faseManual === p.id ? 'sel' : ''}`} onClick={() => pick(p.id)}>
            {p.nome}
          </button>
        ))}
      </div>
    </Sheet>
  )
}

// ---------- Edit any event ----------
export function EditSheet({ event, onClose }: { event: DuleEvent | null; onClose: () => void }) {
  const { updateEvent, removeEvent } = useStore()
  const [inicio, setInicio] = useState('')
  const [fim, setFim] = useState('')
  const [texto, setTexto] = useState('')
  const [confirm, setConfirm] = useState(false)
  useEffect(() => {
    if (!event) return
    setInicio(toLocalInput(event.inicio))
    setFim(event.fim ? toLocalInput(event.fim) : '')
    setTexto(event.texto ?? '')
    setConfirm(false)
  }, [event])
  if (!event) return null

  const save = async () => {
    const i = fromLocalInput(inicio)
    const f = fim ? fromLocalInput(fim) : undefined
    if (Number.isNaN(i) || (f != null && (Number.isNaN(f) || f < i))) return
    await updateEvent({ ...event, inicio: i, fim: f, texto: texto.trim() || undefined })
    onClose()
  }
  const del = async () => {
    if (!confirm) return setConfirm(true)
    await removeEvent(event)
    onClose()
  }
  const isContr = event.tipo === 'contracao'
  return (
    <Sheet open onClose={onClose} title="Editar registro">
      <p className="hint">{describe(event)}</p>
      <Label>{isContr ? 'Começou' : 'Horário'}</Label>
      <input className="field" type="datetime-local" step="1" value={inicio} onChange={(e) => setInicio(e.target.value)} />
      {isContr && (
        <>
          <Label>Terminou</Label>
          <input className="field" type="datetime-local" step="1" value={fim} onChange={(e) => setFim(e.target.value)} />
        </>
      )}
      {!isContr && (
        <>
          <Label>{event.tipo === 'audio' ? 'Transcrição' : 'Texto / nota'}</Label>
          <textarea className="field" rows={3} value={texto} onChange={(e) => setTexto(e.target.value)} />
        </>
      )}
      <button className="primary" onClick={save}>
        Salvar
      </button>
      <button className="danger" onClick={del}>
        {confirm ? 'Toque de novo para apagar' : 'Apagar'}
      </button>
    </Sheet>
  )
}

// ---------- small bits ----------
const Label = ({ children }: { children: React.ReactNode }) => <p className="label">{children}</p>

function Chips({ options, value, onChange }: { options: string[]; value: string | null; onChange: (v: string | null) => void }) {
  return (
    <div className="chips">
      {options.map((o) => (
        <button key={o} className={`chip ${value === o ? 'sel' : ''}`} onClick={() => onChange(value === o ? null : o)}>
          {o}
        </button>
      ))}
    </div>
  )
}

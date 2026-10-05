import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from './store'
import { Timer } from './components/Timer'
import { PhaseWindow } from './components/PhaseWindow'
import { Chat } from './components/Chat'
import { Composer } from './components/Composer'
import { EditSheet, MoodSheet, OptionsSheet, PainSheet, PhasePicker, type OptionsConfig } from './components/Sheets'
import { Report } from './components/Report'
import { ContractionsList } from './components/ContractionsList'
import { Settings } from './components/Settings'
import { BOLSA_CORES, POSICOES, phaseById } from './content'
import { MIN, alertTriggered, contractions, currentPhase, describe, lastOf } from './logic'
import type { DuleEvent, ShortcutDef } from './types'

type Screen = 'main' | 'report' | 'list' | 'settings'

export default function App() {
  const [screen, setScreen] = useState<Screen>('main')
  const [editing, setEditing] = useState<DuleEvent | null>(null)

  return (
    <>
      {screen === 'main' && <Main go={setScreen} onEdit={setEditing} />}
      {screen === 'report' && <Report onBack={() => setScreen('main')} />}
      {screen === 'list' && <ContractionsList onBack={() => setScreen('main')} onEdit={setEditing} />}
      {screen === 'settings' && <Settings onBack={() => setScreen('main')} />}
      <EditSheet event={editing} onClose={() => setEditing(null)} />
    </>
  )
}

function Main({ go, onEdit }: { go: (s: Screen) => void; onEdit: (e: DuleEvent) => void }) {
  const { events, now, parto, settings, addEvent, removeEvent } = useStore()
  const [painOpen, setPainOpen] = useState(false)
  const [moodOpen, setMoodOpen] = useState(false)
  const [chainMood, setChainMood] = useState(false)
  const [phaseOpen, setPhaseOpen] = useState(false)
  const [options, setOptions] = useState<OptionsConfig | null>(null)
  const [highlightPain, setHighlightPain] = useState(false)
  const [toast, setToast] = useState<{ text: string; undo?: DuleEvent } | null>(null)
  const [alertDismissedAt, setAlertDismissedAt] = useState(0)
  const [bolsaDismissed, setBolsaDismissed] = useState<string | null>(null)

  const phase = currentPhase(events, now, parto.faseManual)

  // ---- 5-1-1 alert (re-shows 30 min after being dismissed) ----
  const alert511 = useMemo(() => alertTriggered(events, now, settings.alerta), [events, now, settings.alerta])
  const showAlert = alert511 && now - alertDismissedAt > 30 * MIN
  const vibrated = useRef(false)
  useEffect(() => {
    if (showAlert && !vibrated.current) {
      navigator.vibrate?.([300, 150, 300, 150, 300])
      vibrated.current = true
    }
    if (!alert511) vibrated.current = false
  }, [showAlert, alert511])

  // ---- water broke with greenish / bloody fluid ----
  const bolsa = lastOf(events, 'bolsa')
  const bolsaAlert = bolsa && BOLSA_CORES.find((c) => c.valor === bolsa.valor)?.alerta && bolsaDismissed !== bolsa.id

  // ---- reminders ----
  const cs = contractions(events)
  const lastDor = lastOf(events, 'dor')
  const lastHumor = lastOf(events, 'humor')
  const firstC = cs[0]
  const dorDue =
    settings.lembretes.dorAtivo &&
    cs.length > 0 &&
    (now - (lastDor?.inicio ?? firstC.inicio) >= settings.lembretes.dorMin * MIN ||
      cs.filter((c) => c.inicio > (lastDor?.inicio ?? 0)).length >= settings.lembretes.dorContracoes)
  const humorDue =
    settings.lembretes.humorAtivo && cs.length > 0 && now - (lastHumor?.inicio ?? firstC.inicio) >= settings.lembretes.humorMin * MIN

  const showToast = (text: string, undo?: DuleEvent) => {
    setToast({ text, undo })
    setTimeout(() => setToast((t) => (t?.text === text ? null : t)), 4000)
  }

  const onShortcut = async (s: ShortcutDef) => {
    switch (s.kind) {
      case 'dor':
        setChainMood(false)
        return setPainOpen(true)
      case 'humor':
        return setMoodOpen(true)
      case 'comeu':
        return setOptions({ kind: 'comeu', title: 'O que ela comeu?', textPlaceholder: 'Ex.: banana, torrada (opcional)' })
      case 'bebeu':
        return setOptions({ kind: 'bebeu', title: 'O que e quanto bebeu?', textPlaceholder: 'Ex.: meio copo de água (opcional)' })
      case 'bolsa':
        return setOptions({ kind: 'bolsa', title: 'Cor do líquido', options: BOLSA_CORES.map((c) => c.rotulo) })
      case 'posicao':
        return setOptions({ kind: 'posicao', title: 'Nova posição', options: POSICOES })
      default: {
        const ev = await addEvent({ tipo: 'atalho', atalho: s.kind, rotulo: s.kind === 'custom' ? s.rotulo : undefined, inicio: Date.now() })
        showToast(`${describe(ev)} ✓`, ev)
      }
    }
  }

  const checkIn = () => {
    if (dorDue) {
      setChainMood(!!humorDue)
      setPainOpen(true)
    } else if (humorDue) setMoodOpen(true)
  }

  return (
    <div className="main">
      <header className="top">
        <button className="top-phase" onClick={() => setPhaseOpen(true)}>
          <small>{parto.nome}</small>
          <b>{phase ? phaseById(phase).curto : 'Dule.app'}</b>
        </button>
        <div className="top-actions">
          <button className="icon-btn" onClick={() => go('list')} aria-label="Lista de contrações">
            ☰
          </button>
          <button className="icon-btn" onClick={() => go('settings')} aria-label="Configurações">
            ⚙
          </button>
          <button className="report-btn" onClick={() => go('report')}>
            Relatório
          </button>
        </div>
      </header>

      <Timer
        onStopped={() => {
          setHighlightPain(true)
          setTimeout(() => setHighlightPain(false), 60_000)
        }}
      />

      <div className="scroll">
        {showAlert && (
          <div className="banner alert-511" role="alert">
            <b>Hora de ligar para a maternidade</b>
            <span>
              Contrações a cada ≤ {settings.alerta.intervaloMin} min, durando ~{settings.alerta.duracaoSeg} s, há{' '}
              {settings.alerta.janelaMin} min.
            </span>
            <button onClick={() => setAlertDismissedAt(now)}>Ok</button>
          </div>
        )}
        {bolsaAlert && (
          <div className="banner danger" role="alert">
            <b>Ligue para a equipe agora</b>
            <span>Bolsa rompeu com líquido {bolsa!.valor}.</span>
            <button onClick={() => setBolsaDismissed(bolsa!.id)}>Ok</button>
          </div>
        )}

        {(dorDue || humorDue) && (
          <button className="banner reminder" onClick={checkIn}>
            <b>Hora de perguntar {dorDue && humorDue ? 'a dor e o humor' : dorDue ? 'a dor' : 'o humor'}</b>
            <span>Toque para registrar (no intervalo entre contrações).</span>
          </button>
        )}

        <PhaseWindow onPick={() => setPhaseOpen(true)} />
        <Chat onEdit={onEdit} />
      </div>

      <footer className="bottom">
        <div className="shortcuts">
          {settings.atalhos.map((s) => (
            <button
              key={s.id}
              className={`chip ${s.kind === 'dor' && highlightPain ? 'pulse' : ''} ${s.kind === 'bolsa' ? 'chip-warn' : ''}`}
              onClick={() => onShortcut(s)}
            >
              {s.kind === 'humor' ? '🙂 ' : ''}
              {s.rotulo}
            </button>
          ))}
        </div>
        <Composer />
      </footer>

      {toast && (
        <div className="toast">
          <span>{toast.text}</span>
          {toast.undo && (
            <button
              onClick={() => {
                removeEvent(toast.undo!)
                setToast(null)
              }}
            >
              Desfazer
            </button>
          )}
        </div>
      )}

      <PainSheet
        open={painOpen}
        onClose={() => setPainOpen(false)}
        onSaved={() => {
          setHighlightPain(false)
          if (chainMood) setMoodOpen(true)
        }}
      />
      <MoodSheet open={moodOpen} onClose={() => setMoodOpen(false)} />
      <OptionsSheet config={options} onClose={() => setOptions(null)} />
      <PhasePicker open={phaseOpen} onClose={() => setPhaseOpen(false)} />
    </div>
  )
}

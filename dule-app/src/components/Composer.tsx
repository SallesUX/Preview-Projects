import { useRef, useState } from 'react'
import { useStore } from '../store'
import { db, uid } from '../db'

// Web Speech API (Chrome/Android, Safari iOS 14.5+). Not in TS lib.
type SR = {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null
  onerror: (() => void) | null
  start: () => void
  stop: () => void
}
const SpeechRecognition: (new () => SR) | undefined =
  (window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR }).SpeechRecognition ??
  (window as unknown as { webkitSpeechRecognition?: new () => SR }).webkitSpeechRecognition

export function Composer() {
  const { addEvent } = useStore()
  const [text, setText] = useState('')
  const [rec, setRec] = useState<{ start: number } | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const media = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const speech = useRef<SR | null>(null)
  const transcript = useRef('')
  const startedAt = useRef(0)

  const send = async () => {
    const t = text.trim()
    if (!t) return
    await addEvent({ tipo: 'texto', inicio: Date.now(), texto: t })
    setText('')
  }

  const startRec = async (ev: React.PointerEvent) => {
    ev.preventDefault()
    setErro(null)
    if (media.current) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      chunks.current = []
      transcript.current = ''
      mr.ondataavailable = (e) => e.data.size && chunks.current.push(e.data)
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunks.current, { type: mr.mimeType || 'audio/webm' })
        media.current = null
        // give the recogniser a moment to deliver its final result
        await new Promise((r) => setTimeout(r, 400))
        if (Date.now() - startedAt.current < 700 || blob.size === 0) {
          setErro('Segure o botão enquanto fala.')
          return
        }
        const audioId = uid()
        await db.putAudio(audioId, blob)
        await addEvent({
          tipo: 'audio',
          inicio: startedAt.current,
          audioId,
          texto: transcript.current.trim() || undefined,
        })
      }
      startedAt.current = Date.now()
      mr.start()
      media.current = mr
      setRec({ start: startedAt.current })
      navigator.vibrate?.(20)

      if (SpeechRecognition) {
        try {
          const sr = new SpeechRecognition()
          sr.lang = 'pt-BR'
          sr.continuous = true
          sr.interimResults = false
          sr.onresult = (e) => {
            let t = ''
            for (let i = 0; i < e.results.length; i++) if (e.results[i].isFinal) t += e.results[i][0].transcript + ' '
            transcript.current = t
          }
          sr.onerror = () => {}
          sr.start()
          speech.current = sr
        } catch {
          /* transcription is optional */
        }
      }
    } catch {
      setErro('Não consegui acessar o microfone. Verifique a permissão do navegador.')
    }
  }

  const stopRec = () => {
    speech.current?.stop()
    speech.current = null
    if (media.current && media.current.state !== 'inactive') media.current.stop()
    setRec(null)
  }

  return (
    <div className="composer">
      {erro && <p className="composer-err">{erro}</p>}
      {rec ? (
        <div className="recording">● Gravando… solte para enviar</div>
      ) : (
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Escreva uma nota…"
          enterKeyHint="send"
          aria-label="Nota"
        />
      )}
      {text.trim() && !rec ? (
        <button className="round-btn" onClick={send} aria-label="Enviar">
          ➤
        </button>
      ) : (
        <button
          className={`round-btn mic ${rec ? 'on' : ''}`}
          onPointerDown={startRec}
          onPointerUp={stopRec}
          onPointerCancel={stopRec}
          onPointerLeave={() => rec && stopRec()}
          onContextMenu={(e) => e.preventDefault()}
          aria-label="Segure para gravar áudio"
        >
          🎙
        </button>
      )}
    </div>
  )
}

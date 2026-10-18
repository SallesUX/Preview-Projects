import type { DuleEvent, PhaseId, Settings } from './types'
import { moodByValue, painBand, phaseById } from './content'

export const MIN = 60_000

export const contractions = (events: DuleEvent[]) =>
  events.filter((e) => e.tipo === 'contracao' && e.fim != null).sort((a, b) => a.inicio - b.inicio)

/** Duration in seconds. */
export const durSec = (c: DuleEvent) => Math.round(((c.fim ?? c.inicio) - c.inicio) / 1000)

export interface Stats {
  count: number
  /** average start-to-start interval, minutes */
  avgIntervalMin: number | null
  /** average duration, seconds */
  avgDurationSec: number | null
  /** coefficient of variation of intervals (0 = perfectly regular) */
  irregularity: number | null
  intervalsMin: number[]
}

export function statsFor(cs: DuleEvent[]): Stats {
  const intervals: number[] = []
  for (let i = 1; i < cs.length; i++) intervals.push((cs[i].inicio - cs[i - 1].inicio) / MIN)
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
  const avgI = avg(intervals)
  let cv: number | null = null
  if (avgI && intervals.length >= 2) {
    const sd = Math.sqrt(intervals.reduce((a, x) => a + (x - avgI) ** 2, 0) / intervals.length)
    cv = sd / avgI
  }
  return {
    count: cs.length,
    avgIntervalMin: avgI,
    avgDurationSec: avg(cs.map(durSec)),
    irregularity: cv,
    intervalsMin: intervals,
  }
}

export const inWindow = (cs: DuleEvent[], now: number, minutes: number) =>
  cs.filter((c) => c.inicio >= now - minutes * MIN)

/**
 * Suggested phase from the last hour of contractions.
 * The app only suggests; expulsivo/nascimento are always chosen by hand.
 */
export function suggestPhase(events: DuleEvent[], now: number): PhaseId | null {
  const all = contractions(events)
  if (all.length === 0) return null
  const s = statsFor(inWindow(all, now, 60))
  if (s.count < 3 || s.avgIntervalMin == null) return 'prodromos'
  if (s.avgIntervalMin > 20 || (s.irregularity != null && s.irregularity > 0.6)) return 'prodromos'
  if (s.avgIntervalMin > 5) return 'latente'
  if (s.avgIntervalMin > 3) return 'ativa'
  return 'transicao'
}

export function currentPhase(events: DuleEvent[], now: number, manual: PhaseId | null): PhaseId | null {
  return manual ?? suggestPhase(events, now)
}

/**
 * 5-1-1 (configurable): contractions every ≤ X min, lasting ~Y s, sustained for Z min.
 */
export function alertTriggered(events: DuleEvent[], now: number, rule: Settings['alerta']): boolean {
  const cs = inWindow(contractions(events), now, rule.janelaMin)
  if (cs.length < 3) return false
  const span = (cs[cs.length - 1].inicio - cs[0].inicio) / MIN
  if (span < rule.janelaMin - rule.intervaloMin) return false
  const s = statsFor(cs)
  if (s.avgIntervalMin == null || s.avgDurationSec == null) return false
  const regular = s.intervalsMin.filter((i) => i <= rule.intervaloMin + 0.5).length / s.intervalsMin.length
  return s.avgIntervalMin <= rule.intervaloMin && regular >= 0.8 && s.avgDurationSec >= rule.duracaoSeg - 10
}

export type Trend = 'mais próximas' | 'estáveis' | 'mais espaçadas' | null
export function trend(cs: DuleEvent[]): Trend {
  const s = statsFor(cs)
  if (s.intervalsMin.length < 4) return null
  const half = Math.floor(s.intervalsMin.length / 2)
  const a = statsAvg(s.intervalsMin.slice(0, half))
  const b = statsAvg(s.intervalsMin.slice(half))
  if (b < a * 0.85) return 'mais próximas'
  if (b > a * 1.15) return 'mais espaçadas'
  return 'estáveis'
}
const statsAvg = (xs: number[]) => xs.reduce((x, y) => x + y, 0) / xs.length

export const lastOf = (events: DuleEvent[], kind: DuleEvent['atalho']) =>
  [...events].reverse().find((e) => e.tipo === 'atalho' && e.atalho === kind)

// ---------- formatting ----------

export const fmtClock = (t: number) =>
  new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

export const fmtMMSS = (sec: number) => {
  const s = Math.max(0, Math.round(sec))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/**
 * Whole minutes as "45 min", "2 h 05 min" (from 60 min) or "4 dias 5 h" (from 24 h).
 * A number and its unit are joined by a no-break space so a narrow card never leaves "h" alone.
 */
export const fmtSpan = (totalMin: number) => {
  const m = Math.max(0, Math.round(totalMin))
  const nb = '\u00a0'
  if (m < 60) return `${m}${nb}min`
  const d = Math.floor(m / 1440)
  const h = Math.floor((m % 1440) / 60)
  if (d === 0) return m % 60 ? `${h}${nb}h ${String(m % 60).padStart(2, '0')}${nb}min` : `${h}${nb}h`
  const dias = `${d}${nb}${d === 1 ? 'dia' : 'dias'}`
  return h ? `${dias} ${h}${nb}h` : dias
}

/** Seconds as "45 s", or in minutes from 60 s: "1 min 05 s", "2 min" (and hours via fmtSpan from 60 min). */
export const fmtSeg = (sec: number | null) => {
  if (sec == null) return '—'
  const s = Math.max(0, Math.round(sec))
  const nb = '\u00a0'
  if (s < 60) return `${s}${nb}s`
  if (s >= 3600) return fmtSpan(s / 60)
  const r = s % 60
  return r ? `${Math.floor(s / 60)}${nb}min ${String(r).padStart(2, '0')}${nb}s` : `${s / 60}${nb}min`
}

export const fmtMin = (min: number | null) => {
  if (min == null) return '—'
  if (min < 1) return `${Math.round(min * 60)} s`
  if (min >= 60) return fmtSpan(min)
  return `${min.toFixed(min < 10 ? 1 : 0).replace('.', ',')} min`
}

export const fmtAgo = (t: number, now: number) => {
  const m = Math.round((now - t) / MIN)
  return m < 1 ? 'agora' : `há ${fmtSpan(m)}`
}

export const fmtDuration = (ms: number) => fmtSpan(ms / MIN)

/** One-line human description of any event (chat bubbles + report). */
export function describe(e: DuleEvent): string {
  if (e.tipo === 'contracao') return `Contração de ${fmtSeg(durSec(e))}`
  if (e.tipo === 'texto') return e.texto ?? ''
  if (e.tipo === 'audio') return e.texto ? `Áudio: "${e.texto}"` : 'Áudio'
  const extra = (s?: string) => (s ? ` — ${s}` : '')
  switch (e.atalho) {
    case 'dor': {
      const v = Number(e.valor)
      const parts = [`Dor ${v}/10 (${painBand(v).nome.toLowerCase()})`]
      if (e.local) parts.push(e.local)
      if (e.lidando != null) parts.push(e.lidando ? 'está lidando' : 'não está conseguindo lidar')
      return parts.join(' · ') + extra(e.texto)
    }
    case 'humor': {
      const m = moodByValue(Number(e.valor))
      return `${m?.emoji ?? ''} Humor ${e.valor}/5 — ${m?.nome ?? ''}${e.tags?.length ? ` (${e.tags.join(', ')})` : ''}${extra(e.texto)}`
    }
    case 'comeu':
      return `Comeu${extra(e.texto)}`
    case 'nao_comeu':
      return 'Não quis comer'
    case 'bebeu':
      return `Bebeu${extra(e.texto)}`
    case 'xixi':
      return 'Fez xixi'
    case 'bolsa':
      return `Bolsa rompeu — líquido ${e.valor}`
    case 'posicao':
      return `Posição: ${e.valor}`
    case 'chegamos':
      return 'Chegamos à maternidade'
    default:
      return `${e.rotulo ?? 'Registro'}${extra(e.texto)}`
  }
}

// ---------- report ----------

export interface ReportData {
  periodoMin: number | null
  resumo: string
  marcos: string[]
  contr: { count: number; avgI: string; avgD: string; trend: Trend }
  dor: { ultimo: DuleEvent | undefined; max: number | null; pontos: { t: number; v: number }[] }
  humor: { ultimo: DuleEvent | undefined; pontos: { t: number; v: number }[] }
  ultimos: { rotulo: string; quando: string }[]
  notas: DuleEvent[]
}

export function buildReport(events: DuleEvent[], now: number, periodoMin: number | null, phase: PhaseId | null): ReportData {
  const since = periodoMin == null ? 0 : now - periodoMin * MIN
  const inP = events.filter((e) => e.inicio >= since)
  const cs = contractions(inP)
  const s = statsFor(cs)
  const all = contractions(events)
  const first = all[0]
  const resumoParts: string[] = []
  if (s.count >= 2) {
    resumoParts.push(
      `Contrações a cada ${fmtMin(s.avgIntervalMin)}, durando ${fmtSeg(s.avgDurationSec ?? 0)}`,
    )
  } else resumoParts.push(`${s.count} contração(ões) no período`)
  if (first) resumoParts.push(`início ${fmtAgo(first.inicio, now)}`)
  if (phase) resumoParts.push(`Fase: ${phaseById(phase).curto.toLowerCase()}`)

  const marcos: string[] = []
  if (first) marcos.push(`Início das contrações: ${fmtClock(first.inicio)}`)
  const bolsa = lastOf(events, 'bolsa')
  if (bolsa) marcos.push(`Bolsa: ${fmtClock(bolsa.inicio)} — líquido ${bolsa.valor}`)
  const cheg = lastOf(events, 'chegamos')
  if (cheg) marcos.push(`Chegada à maternidade: ${fmtClock(cheg.inicio)}`)

  const dores = inP.filter((e) => e.atalho === 'dor')
  const humores = inP.filter((e) => e.atalho === 'humor')

  const ultimos = (
    [
      ['Comeu', lastOf(events, 'comeu')],
      ['Bebeu', lastOf(events, 'bebeu')],
      ['Xixi', lastOf(events, 'xixi')],
    ] as const
  ).map(([rotulo, e]) => ({ rotulo, quando: e ? `${fmtClock(e.inicio)} (${fmtAgo(e.inicio, now)})` : 'sem registro' }))

  return {
    periodoMin,
    resumo: resumoParts.join(' · ') + '.',
    marcos,
    contr: { count: s.count, avgI: fmtMin(s.avgIntervalMin), avgD: s.avgDurationSec ? fmtSeg(s.avgDurationSec) : '—', trend: trend(cs) },
    dor: {
      ultimo: dores.at(-1),
      max: dores.length ? Math.max(...dores.map((d) => Number(d.valor))) : null,
      pontos: dores.map((d) => ({ t: d.inicio, v: Number(d.valor) })),
    },
    humor: { ultimo: humores.at(-1), pontos: humores.map((d) => ({ t: d.inicio, v: Number(d.valor) })) },
    ultimos,
    notas: inP.filter((e) => e.tipo !== 'contracao').reverse(),
  }
}

export function reportText(r: ReportData, nome: string, now: number): string {
  const per = r.periodoMin == null ? 'desde o início' : `últimas ${r.periodoMin / 60} h`
  const L: string[] = []
  L.push(`Dule.app — ${nome} — relatório (${per}), ${new Date(now).toLocaleString('pt-BR')}`)
  L.push('', r.resumo)
  if (r.marcos.length) L.push('', 'MARCOS', ...r.marcos.map((m) => `• ${m}`))
  L.push('', 'CONTRAÇÕES', `• ${r.contr.count} no período · intervalo médio ${r.contr.avgI} · duração média ${r.contr.avgD}${r.contr.trend ? ` · ${r.contr.trend}` : ''}`)
  L.push('', 'DOR E HUMOR')
  L.push(`• Dor: ${r.dor.ultimo ? `última ${r.dor.ultimo.valor}/10 às ${fmtClock(r.dor.ultimo.inicio)}` : 'sem registro'}${r.dor.max != null ? ` · máxima ${r.dor.max}/10` : ''}`)
  const hm = r.humor.ultimo ? moodByValue(Number(r.humor.ultimo.valor)) : undefined
  L.push(`• Humor: ${r.humor.ultimo ? `${hm?.emoji} ${hm?.nome} às ${fmtClock(r.humor.ultimo.inicio)}` : 'sem registro'}`)
  L.push('', 'ÚLTIMA VEZ', ...r.ultimos.map((u) => `• ${u.rotulo}: ${u.quando}`))
  if (r.notas.length) L.push('', 'NOTAS', ...r.notas.map((n) => `• ${fmtClock(n.inicio)} — ${describe(n)}`))
  return L.join('\n')
}

import { describe, expect, it } from 'vitest'
import { alertTriggered, buildReport, statsFor, suggestPhase, trend } from './logic'
import type { DuleEvent } from './types'

const NOW = Date.UTC(2026, 11, 10, 12, 0, 0)
const MIN = 60_000

/** n contractions, every `every` minutes, each `dur` seconds, ending near NOW */
function series(n: number, every: number, dur: number): DuleEvent[] {
  return Array.from({ length: n }, (_, i) => {
    const inicio = NOW - (n - 1 - i) * every * MIN - 30_000
    return { id: `c${i}`, partoId: 'p', tipo: 'contracao', inicio, fim: inicio + dur * 1000 }
  })
}

describe('suggestPhase', () => {
  it('null without contractions', () => expect(suggestPhase([], NOW)).toBeNull())
  it('pródromos with few contractions', () => expect(suggestPhase(series(2, 10, 30), NOW)).toBe('prodromos'))
  it('latente every 8 min', () => expect(suggestPhase(series(8, 8, 40), NOW)).toBe('latente'))
  it('ativa every 4 min', () => expect(suggestPhase(series(15, 4, 55), NOW)).toBe('ativa'))
  it('transição every 2.5 min', () => expect(suggestPhase(series(24, 2.5, 75), NOW)).toBe('transicao'))
})

describe('alertTriggered 5-1-1', () => {
  const rule = { intervaloMin: 5, duracaoSeg: 60, janelaMin: 60 }
  it('fires for 1 h of contractions every 4.5 min lasting 60 s', () =>
    expect(alertTriggered(series(14, 4.5, 60), NOW, rule)).toBe(true))
  it('does not fire if only 30 min of pattern', () =>
    expect(alertTriggered(series(7, 4.5, 60), NOW, rule)).toBe(false))
  it('does not fire for short contractions', () =>
    expect(alertTriggered(series(14, 4.5, 30), NOW, rule)).toBe(false))
  it('does not fire for 8-min intervals', () =>
    expect(alertTriggered(series(9, 8, 60), NOW, rule)).toBe(false))
})

describe('stats & trend', () => {
  it('averages', () => {
    const s = statsFor(series(5, 4, 50))
    expect(s.avgIntervalMin).toBeCloseTo(4)
    expect(s.avgDurationSec).toBe(50)
  })
  it('closer contractions', () => {
    const cs: DuleEvent[] = [0, 10, 19, 27, 33, 38, 42].map((m, i) => ({
      id: `${i}`, partoId: 'p', tipo: 'contracao', inicio: NOW + m * MIN, fim: NOW + m * MIN + 50_000,
    }))
    expect(trend(cs)).toBe('mais próximas')
  })
})

describe('report', () => {
  it('summarises last hour with pain and mood', () => {
    const evs: DuleEvent[] = [
      ...series(10, 5, 50),
      { id: 'd', partoId: 'p', tipo: 'atalho', atalho: 'dor', inicio: NOW - 10 * MIN, valor: 7 },
      { id: 'h', partoId: 'p', tipo: 'atalho', atalho: 'humor', inicio: NOW - 5 * MIN, valor: 4 },
      { id: 'x', partoId: 'p', tipo: 'atalho', atalho: 'xixi', inicio: NOW - 40 * MIN },
    ]
    const r = buildReport(evs, NOW, 60, 'latente')
    expect(r.dor.max).toBe(7)
    expect(r.humor.ultimo?.valor).toBe(4)
    expect(r.ultimos.find((u) => u.rotulo === 'Xixi')?.quando).toContain('há 40 min')
    expect(r.resumo).toContain('Fase: latente')
  })
})

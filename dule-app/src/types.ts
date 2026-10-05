export type EventType = 'contracao' | 'texto' | 'audio' | 'atalho'

export type ShortcutKind =
  | 'dor'
  | 'humor'
  | 'comeu'
  | 'nao_comeu'
  | 'bebeu'
  | 'xixi'
  | 'bolsa'
  | 'posicao'
  | 'chegamos'
  | 'custom'

export interface DuleEvent {
  id: string
  partoId: string
  tipo: EventType
  /** epoch ms */
  inicio: number
  /** epoch ms — only for contrações */
  fim?: number
  atalho?: ShortcutKind
  /** label for custom shortcuts */
  rotulo?: string
  /** numeric or text value (dor 0-10, humor 1-5, cor da bolsa…) */
  valor?: number | string
  tags?: string[]
  texto?: string
  /** key into the audio store */
  audioId?: string
  /** pain extras */
  local?: string
  lidando?: boolean
}

export interface Parto {
  id: string
  nome: string
  criadoEm: number
  /** manual override for the phase (null = automatic) */
  faseManual: PhaseId | null
}

export type PhaseId = 'prodromos' | 'latente' | 'ativa' | 'transicao' | 'expulsivo' | 'nascimento'

export interface ShortcutDef {
  id: string
  kind: ShortcutKind
  rotulo: string
}

export interface Settings {
  partoAtivoId: string
  alerta: { intervaloMin: number; duracaoSeg: number; janelaMin: number }
  lembretes: {
    dorAtivo: boolean
    dorMin: number
    dorContracoes: number
    humorAtivo: boolean
    humorMin: number
  }
  atalhos: ShortcutDef[]
}

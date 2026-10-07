import type { PhaseId, ShortcutDef } from './types'

export interface PhaseInfo {
  id: PhaseId
  nome: string
  curto: string
  acontecendo: string
  recomendacoes: string[]
  alivio: string[]
  /** one-line reference shown in the "?" popup: typical contractions and how long the phase lasts */
  guia: { contracoes: string; duracao: string }
}

export const PHASES: PhaseInfo[] = [
  {
    id: 'prodromos',
    nome: 'Pródromos',
    curto: 'Pródromos',
    acontecendo: 'O corpo está se preparando. As contrações são irregulares.',
    recomendacoes: [
      'Seguir a rotina e dormir se for noite',
      'Banho morno para ver se as contrações param',
      'Conferir a mala da maternidade',
    ],
    alivio: ['Banho morno', 'Deitar de lado com almofada entre as pernas', 'Respiração lenta'],
    guia: { contracoes: '20–45 s, irregulares', duracao: 'horas a dias' },
  },
  {
    id: 'latente',
    nome: 'Fase latente',
    curto: 'Latente',
    acontecendo: 'O colo começa a dilatar. Pode durar muitas horas.',
    recomendacoes: [
      'Descansar entre as contrações',
      'Comer leve e beber água',
      'Caminhar, usar a bola, banho morno',
    ],
    alivio: ['Rebolar na bola', 'Banho morno', 'Massagem nas costas'],
    guia: { contracoes: '30–45 s a cada 5–20 min', duracao: 'até 6 cm · 6–12 h' },
  },
  {
    id: 'ativa',
    nome: 'Fase ativa',
    curto: 'Ativa',
    acontecendo: 'A dilatação acelera. As contrações pedem concentração.',
    recomendacoes: [
      'Ir para a maternidade (conforme combinado com a equipe)',
      'Mudar de posição a cada 30–60 min; chuveiro quente na lombar',
      'Goles de água após cada contração; xixi a cada 1–2 h',
    ],
    alivio: [
      'Contrapressão firme na lombar durante a contração',
      'Chuveiro quente na lombar',
      'Respirar junto, soltando o ar devagar',
    ],
    guia: { contracoes: '45–60 s a cada 3–5 min', duracao: '6–8 cm · 4–8 h' },
  },
  {
    id: 'transicao',
    nome: 'Transição',
    curto: 'Transição',
    acontecendo: 'A fase mais intensa e mais curta.',
    recomendacoes: [
      'Ficar colado nela; frases curtas: "você está conseguindo"',
      'Pano frio no rosto e na nuca, sem perguntas',
      '"Não aguento" significa que está perto',
    ],
    alivio: ['Pano frio no rosto', 'Uma contração de cada vez', 'Respirar junto, no ritmo dela'],
    guia: { contracoes: '60–90 s a cada 2–3 min', duracao: '8–10 cm · até 2 h' },
  },
  {
    id: 'expulsivo',
    nome: 'Expulsivo',
    curto: 'Expulsivo',
    acontecendo: 'Dilatação completa, bebê descendo.',
    recomendacoes: [
      'Seguir a equipe e a vontade dela de fazer força',
      'Descansar entre as contrações',
      'Oferecer água e lembrar o plano de parto',
    ],
    alivio: ['Posição que ela escolher', 'Descansar entre as contrações', 'Encorajar em voz baixa'],
    guia: { contracoes: '60–90 s a cada 2–5 min', duracao: 'até 2–3 h' },
  },
  {
    id: 'nascimento',
    nome: 'Nascimento',
    curto: 'Nascimento',
    acontecendo: 'A placenta sai e começa a hora de ouro.',
    recomendacoes: [
      'Contato pele a pele e primeira mamada',
      'Registrar o horário do nascimento',
      'Proteger o momento de visitas',
    ],
    alivio: [],
    guia: { contracoes: 'leves', duracao: 'placenta em 5–30 min' },
  },
]

export const GUIA_AVISO =
  'Valores típicos. Quem confirma a fase é a equipe.'

export const phaseById = (id: PhaseId) => PHASES.find((p) => p.id === id)!

export const ALERTA_RODAPE = {
  titulo: 'Atenção a estes acontecimentos:',
  sinais: 'Sangramento, líquido verde, bebê mexendo menos, febre ou dor de cabeça forte:',
  acao: 'ligue para a equipe.',
}

export const PAIN_BANDS = [
  { min: 0, max: 0, nome: 'Sem dor', desc: 'tranquila' },
  { min: 1, max: 3, nome: 'Leve', desc: 'dá para conversar' },
  { min: 4, max: 6, nome: 'Moderada', desc: 'precisa parar e respirar' },
  { min: 7, max: 8, nome: 'Forte', desc: 'difícil falar na contração' },
  { min: 9, max: 10, nome: 'Muito forte', desc: 'a pior dor imaginável' },
]
export const painBand = (v: number) => PAIN_BANDS.find((b) => v >= b.min && v <= b.max)!
/** green → red */
export const painColor = (v: number) => `hsl(${Math.round(130 - v * 13)} 65% 45%)`

export const MOODS = [
  { valor: 5, emoji: '😄', nome: 'Confiante', desc: 'animada, no controle' },
  { valor: 4, emoji: '🙂', nome: 'Calma', desc: 'tranquila, lidando bem' },
  { valor: 3, emoji: '😴', nome: 'Cansada', desc: 'lidando, mas sem energia' },
  { valor: 2, emoji: '😟', nome: 'Ansiosa', desc: 'com medo ou insegura' },
  { valor: 1, emoji: '😫', nome: 'Sobrecarregada', desc: 'em pânico, quer desistir' },
]
export const moodByValue = (v: number) => MOODS.find((m) => m.valor === v)
export const MOOD_TAGS = ['focada', 'emotiva', 'irritada', 'com sono', 'com náusea', 'com frio', 'com calor']

export const APOIO_EMOCIONAL = [
  'Respirar junto com ela, devagar',
  'Lembrar o quanto ela já avançou',
  'Diminuir luz e barulho; pedir para as pessoas saírem',
]

export const BOLSA_CORES = [
  { valor: 'claro', rotulo: 'Claro', alerta: false },
  { valor: 'esverdeado', rotulo: 'Esverdeado', alerta: true },
  { valor: 'com sangue', rotulo: 'Com sangue', alerta: true },
]

export const POSICOES = ['Bola', 'Chuveiro', 'De lado', 'De cócoras', 'Em pé', 'De quatro']

export const DEFAULT_SHORTCUTS: ShortcutDef[] = [
  { id: 'dor', kind: 'dor', rotulo: 'Dor' },
  { id: 'humor', kind: 'humor', rotulo: 'Humor' },
  { id: 'comeu', kind: 'comeu', rotulo: 'Comeu' },
  { id: 'nao_comeu', kind: 'nao_comeu', rotulo: 'Não quis comer' },
  { id: 'bebeu', kind: 'bebeu', rotulo: 'Bebeu' },
  { id: 'xixi', kind: 'xixi', rotulo: 'Xixi' },
  { id: 'bolsa', kind: 'bolsa', rotulo: 'Bolsa rompeu' },
  { id: 'posicao', kind: 'posicao', rotulo: 'Posição' },
  { id: 'chegamos', kind: 'chegamos', rotulo: 'Chegamos' },
]

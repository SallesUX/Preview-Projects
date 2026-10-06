import type { PhaseId, ShortcutDef } from './types'

export interface PhaseInfo {
  id: PhaseId
  nome: string
  curto: string
  acontecendo: string
  recomendacoes: string[]
  alivio: string[]
  /** short reference shown in the "?" guide: typical contractions, how long the phase lasts, how the app suggests it */
  guia: { contracoes: string; duracao: string; noApp: string }
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
    guia: {
      contracoes: 'Irregulares, de 20 a 45 s, com intervalos longos e variados (mais de 10–20 min). Costumam diminuir com repouso ou banho.',
      duracao: 'De horas a alguns dias, ainda sem dilatação importante.',
      noApp: 'Intervalo médio acima de 20 min ou contrações irregulares.',
    },
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
    guia: {
      contracoes: 'De 30 a 45 s, a cada 5 a 20 min, ficando mais regulares.',
      duracao: 'Até uns 6 cm de dilatação. Costuma levar de 6 a 12 h ou mais no primeiro filho.',
      noApp: 'Intervalo médio entre 5 e 20 min.',
    },
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
    guia: {
      contracoes: 'De 45 a 60 s, a cada 3 a 5 min, fortes e regulares.',
      duracao: 'De 6 a 8 cm. Em geral de 4 a 8 h.',
      noApp: 'Intervalo médio entre 3 e 5 min.',
    },
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
    guia: {
      contracoes: 'De 60 a 90 s, a cada 2 a 3 min, quase sem pausa entre elas.',
      duracao: 'De 8 a 10 cm. Curta: de 15 min a 1–2 h.',
      noApp: 'Intervalo médio abaixo de 3 min.',
    },
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
    guia: {
      contracoes: 'De 60 a 90 s, a cada 2 a 5 min, com vontade de fazer força.',
      duracao: 'Dilatação completa até o nascimento. De minutos a 2–3 h.',
      noApp: 'Escolhida por vocês (toque no título da fase).',
    },
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
    guia: {
      contracoes: 'Leves, para soltar a placenta.',
      duracao: 'A placenta sai em geral de 5 a 30 min depois do bebê.',
      noApp: 'Escolhida por vocês (toque no título da fase).',
    },
  },
]

export const GUIA_AVISO =
  'Valores típicos, que variam muito de pessoa para pessoa. Quem confirma a fase é a equipe, pelo exame.'

export const phaseById = (id: PhaseId) => PHASES.find((p) => p.id === id)!

export const ALERTA_RODAPE =
  'Sangramento, líquido verde, bebê mexendo menos, febre ou dor de cabeça forte: ligue para a equipe.'

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

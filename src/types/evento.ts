export type EventoPublico = 'tutor' | 'parceiro'

export type EventoOrgTipo =
  | 'ong'
  | 'prefeitura'
  | 'clinica_veterinaria'
  | 'petshop'
  | 'outro'

export const EVENTO_INTERESSES_TUTOR = [
  { id: 'tag_qr_nfc', label: 'Tag QR + NFC para meu pet' },
  { id: 'pet_perdido', label: 'Ajuda se o pet se perder' },
  { id: 'adocao', label: 'Adoção responsável' },
  { id: 'conhecer', label: 'Só quero conhecer a plataforma' },
] as const

export const EVENTO_INTERESSES_PARCEIRO = [
  { id: 'painel_orgao', label: 'Painel para órgãos / ONGs' },
  { id: 'inventario', label: 'Inventário de animais sob cuidados' },
  { id: 'resgates', label: 'Registro de resgates e matching' },
  { id: 'demo', label: 'Agendar demonstração' },
  { id: 'parceria_feira', label: 'Parceria no evento / feira' },
] as const

export const EVENTO_ESPECIES = [
  { id: 'cao', label: 'Cão' },
  { id: 'gato', label: 'Gato' },
  { id: 'outro', label: 'Outro' },
] as const

export const EVENTO_ORG_TIPOS: { id: EventoOrgTipo; label: string }[] = [
  { id: 'ong', label: 'ONG / protetor' },
  { id: 'prefeitura', label: 'Prefeitura / CCZ' },
  { id: 'clinica_veterinaria', label: 'Clínica veterinária' },
  { id: 'petshop', label: 'Pet shop / negócio pet' },
  { id: 'outro', label: 'Outro' },
]

export interface CadastroEventoTutorInput {
  tipo_publico: 'tutor'
  nome: string
  email: string
  telefone: string
  cidade: string
  estado: string
  qtd_pets: number
  especies_pets: string[]
  ja_conhece_mypetid: boolean
  interesses_tutor: string[]
  como_soube: string
  aceita_contato: boolean
  aceite_lgpd: boolean
}

export interface CadastroEventoParceiroInput {
  tipo_publico: 'parceiro'
  nome: string
  email: string
  telefone: string
  cidade: string
  estado: string
  organizacao_nome: string
  organizacao_tipo: EventoOrgTipo
  organizacao_tipo_outro: string
  cnpj: string
  cargo: string
  regiao_atuacao: string
  volume_animais_mes: string
  interesses_parceiro: string[]
  ja_usa_sistema: boolean
  aceita_contato: boolean
  aceite_lgpd: boolean
}

export type CadastroEventoInput =
  | CadastroEventoTutorInput
  | CadastroEventoParceiroInput

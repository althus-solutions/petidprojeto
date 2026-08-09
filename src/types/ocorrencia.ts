export type OcorrenciaStatus = 'aberta' | 'reencontrado' | 'expirada'

export type ComIdentificacao = 'sim' | 'nao' | 'nao_sei'

export type FonteLocalizacao = 'autocomplete' | 'manual' | 'gps'

export type RaioBuscaKm = 1 | 2 | 5 | 10

export interface OcorrenciaPerdido {
  id: string
  animal_id: string
  tutor_id: string
  data_perda: string
  endereco_aproximado: string | null
  estado?: string | null
  cidade?: string | null
  bairro?: string | null
  status: OcorrenciaStatus
  retroativa: boolean
  horario_perda?: string | null
  horario_desconhecido?: boolean
  com_identificacao?: ComIdentificacao | null
  circunstancias?: string | null
  foto_dia_path?: string | null
  /** Interno — matching; não é escolha do tutor na UI. */
  raio_busca_km?: number
  contato_alternativo?: string | null
  fonte_localizacao?: FonteLocalizacao | null
  created_at: string
}

export interface OcorrenciaAbertaMapa {
  id: string
  animal_id: string
  animal_nome: string
  animal_especie: string | null
  animal_foto_path: string | null
  data_perda: string
  endereco_aproximado: string | null
  status: OcorrenciaStatus
  retroativa: boolean
  created_at: string
  latitude: number
  longitude: number
  localizado: boolean
  ultima_leitura_lat: number | null
  ultima_leitura_lng: number | null
  /** ISO timestamp da última leitura com GPS (para aviso no mapa). */
  ultima_leitura_em?: string | null
  /** Endereço textual (reverse geocode) da última leitura. */
  ultima_leitura_endereco?: string | null
  /** ISO da última leitura qualquer (com ou sem GPS) — badge na aba Ocorrências. */
  ultima_interacao_em?: string | null
}

export interface AbrirOcorrenciaResultado {
  ocorrencia_id: string
  animal_nome: string
  status: OcorrenciaStatus
  estado?: string
  cidade?: string
  bairro?: string
  raio_busca_km?: number
}

export interface AbrirOcorrenciaInput {
  animalId: string
  dataPerda: string
  latitude: number
  longitude: number
  estado: string
  cidade: string
  bairro: string
  enderecoAproximado?: string
  retroativa: boolean
  horarioPerda?: string | null
  horarioDesconhecido: boolean
  comIdentificacao: ComIdentificacao
  circunstancias?: string
  fotoDiaPath?: string | null
  /** Sempre o default interno no MVP; alertas por raio/bairro vêm depois. */
  raioBuscaKm: RaioBuscaKm
  contatoAlternativo?: string
  fonteLocalizacao: FonteLocalizacao
  consentimentoOcorrencia: boolean
}

export const CONSENTIMENTO_OCORRENCIA_TEXTO =
  'Autorizo o compartilhamento da localização aproximada (estado, cidade e bairro) e das características deste caso com usuários e organizações parceiras para fins de busca e matching.'

export type OcorrenciaStatus = 'aberta' | 'reencontrado' | 'expirada'

export interface OcorrenciaPerdido {
  id: string
  animal_id: string
  tutor_id: string
  data_perda: string
  endereco_aproximado: string | null
  status: OcorrenciaStatus
  retroativa: boolean
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
}

export interface AbrirOcorrenciaResultado {
  ocorrencia_id: string
  animal_nome: string
  status: OcorrenciaStatus
}

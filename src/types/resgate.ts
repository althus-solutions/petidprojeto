export type ResgateStatus =
  | 'disponivel'
  | 'em_analise'
  | 'reencontrado'
  | 'anonimizado'

export interface CaptchaResgateConfig {
  habilitado: boolean
  site_key: string
  versao_termos_consentimento: string
  texto_consentimento: string
}

export interface UploadResgateToken {
  upload_token_id: string
  storage_path: string
}

export interface ConfirmarResgateResultado {
  registro_id: string
  status: ResgateStatus
}

export const PORTES_ESTIMADOS = ['Pequeno', 'Médio', 'Grande'] as const
export type PorteEstimado = (typeof PORTES_ESTIMADOS)[number]

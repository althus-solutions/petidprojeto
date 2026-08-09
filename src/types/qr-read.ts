export interface PetPublicoQr {
  id: string
  nome: string
  especie: string | null
  raca: string | null
  porte: string | null
  cor: string | null
  caracteristicas: string | null
  foto_path: string | null
  /** Paths no Storage (bucket pets), ordenados — galeria pública. */
  foto_paths?: string[] | null
  tem_foto: boolean
  tem_tutor?: boolean
  tutor_nome?: string | null
  /** true só se existir ocorrência de perda com status=aberta */
  ocorrencia_aberta?: boolean
}

export interface PaginaQrConfig {
  titulo: string
  instrucao: string
  mensagem_contato: string
  texto_consentimento: string
  versao_termos_consentimento: string
}

export interface LeituraQrResultado {
  leitura_id: string
  animal_nome: string
  notificado: boolean
  com_localizacao: boolean
  ocorrencia_aberta?: boolean
  /** E.164 só dígitos (ex.: 5511999999999), disponível após confirmação. */
  tutor_telefone_whatsapp?: string | null
}

export type PetPublicStep =
  | 'loading'
  | 'profile'
  | 'safe'
  | 'done'
  | 'error'

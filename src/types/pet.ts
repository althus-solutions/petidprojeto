export type CampoPetTipo =
  | 'text'
  | 'number'
  | 'textarea'
  | 'select'
  | 'foto'

export interface CampoFormularioPet {
  nome: string
  label: string
  tipo: CampoPetTipo
  obrigatorio?: boolean
  visivel?: boolean
  ordem?: number
  opcoes?: string[]
}

export interface ConfigCamposPet {
  campos: CampoFormularioPet[]
}

export interface Animal {
  id: string
  tutor_id: string
  nome: string
  especie: string | null
  raca: string | null
  porte: string | null
  cor: string | null
  peso: number | null
  caracteristicas: string | null
  foto_url: string | null
  qr_payload: string
  created_at: string
}

export type PetFormValues = Record<string, string | number | File | null | undefined>

export const COLUNAS_ANIMAIS = [
  'nome',
  'especie',
  'raca',
  'porte',
  'cor',
  'peso',
  'caracteristicas',
] as const

export type ColunaAnimal = (typeof COLUNAS_ANIMAIS)[number]

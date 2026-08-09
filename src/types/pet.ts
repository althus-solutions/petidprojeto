export type CampoPetTipo =
  | 'text'
  | 'number'
  | 'textarea'
  | 'select'
  | 'foto'
  | 'fotos'
  | 'multiselect'
  | 'idade'

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

export type SexoPet = 'macho' | 'femea' | 'nao_sei'
export type CastradoPet = 'sim' | 'nao' | 'nao_sei'
export type PadraoPelagem =
  | 'curto'
  | 'medio'
  | 'longo'
  | 'enrolado'
  | 'sem_pelo'
export type IdadeUnidade = 'meses' | 'anos'
export type FotoSlot = 'corpo' | 'lateral' | 'rosto' | 'marca' | 'outro'

export const FOTO_SLOTS: { slot: FotoSlot; label: string }[] = [
  { slot: 'corpo', label: 'Corpo inteiro' },
  { slot: 'lateral', label: 'Lateral' },
  { slot: 'rosto', label: 'Rosto' },
  { slot: 'marca', label: 'Marca distintiva' },
]

export const CORES_PADRAO = [
  'Branco',
  'Preto',
  'Marrom',
  'Caramelo',
  'Cinza',
  'Dourado',
  'Rajado',
  'Malhado',
  'Tricolor',
  'Outro',
] as const

export interface PetFotoSlotValue {
  slot: FotoSlot
  file: File | null
  previewUrl?: string | null
  /** Path já salvo no Storage (edição — slot sem arquivo novo). */
  storagePath?: string | null
}

export interface AnimalFoto {
  id: string
  animal_id: string
  storage_path: string
  slot: FotoSlot
  ordem: number
}

export interface Animal {
  id: string
  tutor_id: string
  nome: string
  especie: string | null
  raca: string | null
  porte: string | null
  cor: string | null
  cores: string[] | null
  peso: number | null
  caracteristicas: string | null
  sexo: SexoPet | null
  data_nascimento: string | null
  idade_estimada_valor: number | null
  idade_estimada_unidade: IdadeUnidade | null
  castrado: CastradoPet | null
  padrao_pelagem: PadraoPelagem | null
  foto_url: string | null
  consentimento_fotos_em: string | null
  consentimento_fotos_contexto: Record<string, unknown> | null
  qr_payload: string
  created_at: string
}

export type PetFormValues = Record<
  string,
  | string
  | number
  | boolean
  | File
  | File[]
  | string[]
  | PetFotoSlotValue[]
  | null
  | undefined
>

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

export const CONSENTIMENTO_FOTOS_TEXTO =
  'Autorizo o uso da(s) foto(s) e características deste pet para fins de identificação e matching automático na plataforma, conforme a Política de Privacidade.'

export const MAX_PET_FOTOS = 4
export const MAX_PET_FOTO_BYTES = 5 * 1024 * 1024

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

/** Um único slot de foto no cadastro/edição do pet. */
export const FOTO_SLOTS: { slot: FotoSlot; label: string }[] = [
  { slot: 'corpo', label: 'Foto do pet' },
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
  /** Número do microchip (opcional). */
  microchip: string | null
  /** Payload da tag — null até gerar QR/NFC. */
  qr_payload: string | null
  /**
   * nao_solicitada → solicitada (pedido; pagamento futuro) → registrada (QR/NFC gerados).
   */
  tag_status: TagStatus
  created_at: string
}

export type TagStatus = 'nao_solicitada' | 'solicitada' | 'registrada'

export function labelTagStatus(status: TagStatus | string | null | undefined): {
  label: string
  variant: 'brand' | 'success' | 'warning'
} {
  switch (status) {
    case 'registrada':
      return { label: 'Tag registrada', variant: 'success' }
    case 'solicitada':
      return { label: 'Tag solicitada', variant: 'warning' }
    default:
      return { label: 'Sem tag', variant: 'brand' }
  }
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
  'microchip',
] as const

export type ColunaAnimal = (typeof COLUNAS_ANIMAIS)[number]

export const CONSENTIMENTO_FOTOS_TEXTO =
  'Autorizo o uso da foto e características deste pet para fins de identificação e matching automático na plataforma, conforme a Política de Privacidade.'

export const MAX_PET_FOTOS = 1
export const MAX_PET_FOTO_BYTES = 5 * 1024 * 1024

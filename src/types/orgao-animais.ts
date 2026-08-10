export type AnimalOrganizacaoStatus =
  | 'sob_cuidados'
  | 'disponivel_adocao'
  | 'devolvido'
  | 'transferido'
  | 'obito'

export interface AnimalOrganizacao {
  id: string
  organizacao_id: string
  organizacao_nome?: string
  organizacao_tipo?: string
  nome: string | null
  especie: string | null
  raca: string | null
  porte: string | null
  cor: string | null
  sexo: string | null
  caracteristicas: string | null
  microchip: string | null
  foto_url: string | null
  status: AnimalOrganizacaoStatus
  registro_resgate_id: string | null
  created_at: string
  updated_at: string
}

export interface CriarAnimalOrganizacaoInput {
  nome?: string
  especie?: string
  raca?: string
  porte?: string
  cor?: string
  sexo?: string
  caracteristicas?: string
  microchip?: string
  foto?: File | null
  status?: AnimalOrganizacaoStatus
}

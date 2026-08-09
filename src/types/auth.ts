export type UserRole = 'tutor' | 'orgao' | 'admin'

export type OrganizacaoTipo =
  | 'prefeitura'
  | 'pm'
  | 'bombeiros'
  | 'ccz'
  | 'ong'
  | 'veterinaria'

export type OrganizacaoStatus = 'pendente' | 'aprovado' | 'rejeitado'

export type CanalNotificacao = 'whatsapp' | 'email' | 'push'

export interface TutorProfile {
  id: string
  nome: string
  telefone: string | null
  email: string | null
  canal_notificacao_preferido: CanalNotificacao | null
  foto_url: string | null
  /** Endereço residencial — privado (só mapa do tutor, nunca no /pet). */
  endereco_estado?: string | null
  endereco_cidade?: string | null
  endereco_bairro?: string | null
  endereco_latitude?: number | null
  endereco_longitude?: number | null
}

export interface OrganizacaoProfile {
  id: string
  nome: string
  tipo: OrganizacaoTipo
  status_aprovacao: OrganizacaoStatus
}

export interface PendingOrgaoMetadata {
  nome: string
  tipo: OrganizacaoTipo
}

export interface PendingTutorMetadata {
  nome: string
  telefone?: string
  canal_notificacao_preferido?: CanalNotificacao
}

export interface MfaStatus {
  enrolled: boolean
  verified: boolean
  currentLevel: string | null
  nextLevel: string | null
}

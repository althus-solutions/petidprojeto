import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type {
  MfaStatus,
  OrganizacaoProfile,
  PendingOrgaoMetadata,
  PendingTutorMetadata,
  TutorProfile,
  UserRole,
} from '@/types/auth'

export type { UserRole } from '@/types/auth'

/** Traduz erros comuns do Supabase Auth para mensagens claras em PT. */
export function mapAuthErrorMessage(message: string): string {
  const lower = message.toLowerCase()
  if (lower.includes('email not confirmed')) {
    return 'E-mail ainda não confirmado. Verifique sua caixa de entrada ou aguarde a aprovação da organização pelo administrador.'
  }
  if (lower.includes('invalid login credentials')) {
    return 'E-mail ou senha incorretos.'
  }
  return message
}

export interface AuthUser {
  id: string
  email?: string
  role: UserRole | null
  tutor?: TutorProfile
  organizacao?: OrganizacaoProfile
  mfa: MfaStatus
}

function resolveRoleFromMetadata(
  metadata: Record<string, unknown> | undefined,
): UserRole | null {
  const role = metadata?.role
  if (role === 'tutor' || role === 'orgao' || role === 'admin') {
    return role
  }
  return null
}

/** Alinhado a `is_platform_admin()` no Postgres (user_metadata ou app_metadata). */
export function resolveRoleFromUser(user: User): UserRole | null {
  const fromUserMetadata = resolveRoleFromMetadata(user.user_metadata)
  if (fromUserMetadata) return fromUserMetadata
  return resolveRoleFromMetadata(user.app_metadata)
}

export async function getMfaStatus(): Promise<MfaStatus> {
  const { data: aal, error: aalError } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel()

  if (aalError || !aal) {
    return {
      enrolled: false,
      verified: false,
      currentLevel: null,
      nextLevel: null,
    }
  }

  const { data: factors } = await supabase.auth.mfa.listFactors()
  const enrolled = (factors?.totp ?? []).some((f) => f.status === 'verified')

  return {
    enrolled,
    verified: aal.currentLevel === 'aal2',
    currentLevel: aal.currentLevel,
    nextLevel: aal.nextLevel,
  }
}

const TUTOR_SELECT_FULL =
  'id, nome, telefone, email, canal_notificacao_preferido, foto_url, endereco_estado, endereco_cidade, endereco_bairro, endereco_latitude, endereco_longitude'

const TUTOR_SELECT_FOTO =
  'id, nome, telefone, email, canal_notificacao_preferido, foto_url'

const TUTOR_SELECT_LEGACY =
  'id, nome, telefone, email, canal_notificacao_preferido'

function mapTutorRow(data: {
  id: string
  nome: string
  telefone: string | null
  email: string | null
  canal_notificacao_preferido: TutorProfile['canal_notificacao_preferido']
  foto_url?: string | null
  endereco_estado?: string | null
  endereco_cidade?: string | null
  endereco_bairro?: string | null
  endereco_latitude?: number | null
  endereco_longitude?: number | null
}): TutorProfile {
  return {
    id: data.id,
    nome: data.nome,
    telefone: data.telefone,
    email: data.email,
    canal_notificacao_preferido: data.canal_notificacao_preferido,
    foto_url: data.foto_url ?? null,
    endereco_estado: data.endereco_estado ?? null,
    endereco_cidade: data.endereco_cidade ?? null,
    endereco_bairro: data.endereco_bairro ?? null,
    endereco_latitude:
      typeof data.endereco_latitude === 'number' ? data.endereco_latitude : null,
    endereco_longitude:
      typeof data.endereco_longitude === 'number'
        ? data.endereco_longitude
        : null,
  }
}

function isMissingColumnError(
  error: { code?: string; message?: string } | null,
  columnHint: string,
) {
  if (!error) return false
  const msg = (error.message ?? '').toLowerCase()
  return error.code === '42703' || msg.includes(columnHint.toLowerCase())
}

async function loadTutorProfile(userId: string): Promise<TutorProfile | undefined> {
  const withEndereco = await supabase
    .from('tutores')
    .select(TUTOR_SELECT_FULL)
    .eq('user_id', userId)
    .maybeSingle()

  if (!withEndereco.error) {
    return withEndereco.data ? mapTutorRow(withEndereco.data) : undefined
  }

  // Migration 026 ainda não aplicada
  if (isMissingColumnError(withEndereco.error, 'endereco_')) {
    const withFoto = await supabase
      .from('tutores')
      .select(TUTOR_SELECT_FOTO)
      .eq('user_id', userId)
      .maybeSingle()

    if (!withFoto.error) {
      return withFoto.data ? mapTutorRow(withFoto.data) : undefined
    }

    // Migration 017 ainda não aplicada
    if (isMissingColumnError(withFoto.error, 'foto_url')) {
      const legacy = await supabase
        .from('tutores')
        .select(TUTOR_SELECT_LEGACY)
        .eq('user_id', userId)
        .maybeSingle()

      return legacy.data ? mapTutorRow(legacy.data) : undefined
    }
  }

  return undefined
}

async function loadOrganizacaoProfile(
  userId: string,
): Promise<OrganizacaoProfile | undefined> {
  const { data: vinculo } = await supabase
    .from('usuarios_organizacao')
    .select('organizacao_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (!vinculo) return undefined

  const { data: org } = await supabase
    .from('organizacoes')
    .select('id, nome, tipo, status_aprovacao')
    .eq('id', vinculo.organizacao_id)
    .maybeSingle()

  return org ?? undefined
}

export async function ensureTutorProfile(
  user: User,
  metadata: PendingTutorMetadata,
): Promise<TutorProfile | undefined> {
  const existing = await loadTutorProfile(user.id)
  if (existing) return existing

  const insertPayload = {
    user_id: user.id,
    nome: metadata.nome,
    telefone: metadata.telefone ?? null,
    email: user.email ?? null,
    canal_notificacao_preferido: metadata.canal_notificacao_preferido ?? 'email',
  }

  const withEndereco = await supabase
    .from('tutores')
    .insert(insertPayload)
    .select(TUTOR_SELECT_FULL)
    .single()

  if (!withEndereco.error && withEndereco.data) {
    return mapTutorRow(withEndereco.data)
  }

  if (isMissingColumnError(withEndereco.error, 'endereco_')) {
    const withFoto = await supabase
      .from('tutores')
      .insert(insertPayload)
      .select(TUTOR_SELECT_FOTO)
      .single()

    if (!withFoto.error && withFoto.data) {
      return mapTutorRow(withFoto.data)
    }

    if (isMissingColumnError(withFoto.error, 'foto_url')) {
      const legacy = await supabase
        .from('tutores')
        .insert(insertPayload)
        .select(TUTOR_SELECT_LEGACY)
        .single()

      if (legacy.error) throw legacy.error
      return mapTutorRow(legacy.data)
    }

    if (withFoto.error) throw withFoto.error
  }

  if (withEndereco.error) throw withEndereco.error
  return undefined
}

export async function ensureOrgaoProfile(
  user: User,
  metadata: PendingOrgaoMetadata,
): Promise<OrganizacaoProfile | undefined> {
  const existing = await loadOrganizacaoProfile(user.id)
  if (existing) return existing

  const { data: org, error: orgError } = await supabase
    .from('organizacoes')
    .insert({
      nome: metadata.nome,
      tipo: metadata.tipo,
      status_aprovacao: 'pendente',
    })
    .select('id, nome, tipo, status_aprovacao')
    .single()

  if (orgError) throw orgError

  const { error: vinculoError } = await supabase
    .from('usuarios_organizacao')
    .insert({
      organizacao_id: org.id,
      user_id: user.id,
      papel: 'admin_org',
    })

  if (vinculoError) throw vinculoError
  return org
}

export async function syncProfilesFromMetadata(user: User): Promise<void> {
  const role = resolveRoleFromUser(user)
  if (!role) return

  if (role === 'tutor' && user.user_metadata?.nome) {
    await ensureTutorProfile(user, {
      nome: String(user.user_metadata.nome),
      telefone: user.user_metadata.telefone
        ? String(user.user_metadata.telefone)
        : undefined,
      canal_notificacao_preferido: user.user_metadata
        .canal_notificacao_preferido as PendingTutorMetadata['canal_notificacao_preferido'],
    })
  }

  if (role === 'orgao' && user.user_metadata?.pending_org) {
    const pending = user.user_metadata.pending_org as PendingOrgaoMetadata
    await ensureOrgaoProfile(user, pending)
  }
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.user) return null

  const user = session.user
  const role = resolveRoleFromUser(user)
  const mfa = role === 'admin' ? await getMfaStatus() : {
    enrolled: false,
    verified: true,
    currentLevel: 'aal1',
    nextLevel: 'aal1',
  }

  let tutor: TutorProfile | undefined
  let organizacao: OrganizacaoProfile | undefined

  if (role === 'tutor') {
    tutor = await loadTutorProfile(user.id)
  }

  if (role === 'orgao') {
    organizacao = await loadOrganizacaoProfile(user.id)
  }

  return {
    id: user.id,
    email: user.email,
    role,
    tutor,
    organizacao,
    mfa,
  }
}

export function roleHomePath(role: UserRole | null | undefined): string {
  switch (role) {
    case 'admin':
      return '/admin'
    case 'orgao':
      return '/orgao'
    case 'tutor':
      return '/tutor'
    default:
      return '/'
  }
}

export function isOrgApproved(user: AuthUser | null): boolean {
  return user?.organizacao?.status_aprovacao === 'aprovado'
}

export function adminNeedsMfa(user: AuthUser | null): boolean {
  if (user?.role !== 'admin') return false
  return !user.mfa.verified
}

export function adminNeedsMfaEnrollment(user: AuthUser | null): boolean {
  if (user?.role !== 'admin') return false
  return !user.mfa.enrolled
}

export async function signOut() {
  await supabase.auth.signOut()
}

export async function signUpTutor(input: {
  email: string
  password: string
  nome: string
  telefone?: string
  canal_notificacao_preferido?: PendingTutorMetadata['canal_notificacao_preferido']
}) {
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: {
        role: 'tutor',
        nome: input.nome,
        telefone: input.telefone,
        canal_notificacao_preferido: input.canal_notificacao_preferido ?? 'email',
      },
    },
  })

  if (error) throw error
  if (data.session?.user) {
    await ensureTutorProfile(data.session.user, {
      nome: input.nome,
      telefone: input.telefone,
      canal_notificacao_preferido: input.canal_notificacao_preferido,
    })
  }

  return data
}

export async function signUpOrgao(input: {
  email: string
  password: string
  nome: string
  tipo: PendingOrgaoMetadata['tipo']
  responsavel: string
}) {
  const pendingOrg: PendingOrgaoMetadata = {
    nome: input.nome,
    tipo: input.tipo,
  }

  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: {
        role: 'orgao',
        nome_responsavel: input.responsavel,
        pending_org: pendingOrg,
      },
    },
  })

  if (error) throw error

  if (!data.user) {
    throw new Error(
      'Não foi possível criar a conta. Verifique o e-mail ou tente fazer login.',
    )
  }

  if (data.user.identities?.length === 0) {
    throw new Error(
      'Este e-mail já possui cadastro. Faça login ou use outro e-mail institucional.',
    )
  }

  if (data.session?.user) {
    await ensureOrgaoProfile(data.session.user, pendingOrg)
  }

  return data
}

export async function signInWithPassword(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) throw error

  if (data.session?.user) {
    await syncProfilesFromMetadata(data.session.user)
  }

  return data
}

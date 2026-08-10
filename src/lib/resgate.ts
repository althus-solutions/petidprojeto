import { supabase } from '@/lib/supabase'
import type {
  CaptchaResgateConfig,
  ConfirmarResgateResultado,
  UploadResgateToken,
} from '@/types/resgate'

const FINGERPRINT_KEY = 'petid_resgate_fingerprint'

const CAPTCHA_PADRAO: CaptchaResgateConfig = {
  habilitado: true,
  site_key: import.meta.env.VITE_TURNSTILE_SITE_KEY ?? '1x00000000000000000000AA',
  versao_termos_consentimento: '1.0',
  texto_consentimento:
    'Autorizo compartilhar a localização aproximada deste registro para ajudar no reencontro do animal.',
}

const BUCKET_RESGATES = 'resgates'

export function getOrCreateResgateFingerprint(): string {
  try {
    const existing = localStorage.getItem(FINGERPRINT_KEY)
    if (existing) return existing

    const fingerprint = `fp_${crypto.randomUUID().replace(/-/g, '')}`
    localStorage.setItem(FINGERPRINT_KEY, fingerprint)
    return fingerprint
  } catch {
    return `fp_${crypto.randomUUID().replace(/-/g, '')}`
  }
}

export async function fetchCaptchaResgateConfig(): Promise<CaptchaResgateConfig> {
  const { data, error } = await supabase
    .from('configuracoes_sistema')
    .select('valor')
    .eq('chave', 'captcha_resgate')
    .maybeSingle()

  if (error) throw error

  const config = data?.valor as Partial<CaptchaResgateConfig> | undefined
  const siteKey =
    import.meta.env.VITE_TURNSTILE_SITE_KEY ?? config?.site_key ?? CAPTCHA_PADRAO.site_key

  return { ...CAPTCHA_PADRAO, ...config, site_key: siteKey }
}

export async function solicitarUploadResgateAnonimo(params: {
  turnstileToken: string
  honeypot?: string
}): Promise<UploadResgateToken> {
  const { data, error } = await supabase.rpc('solicitar_upload_resgate_anonimo', {
    p_turnstile_token: params.turnstileToken,
    p_fingerprint: getOrCreateResgateFingerprint(),
    p_honeypot: params.honeypot ?? null,
  })

  if (error) throw error
  return data as UploadResgateToken
}

export async function uploadResgatePhoto(
  storagePath: string,
  file: File,
): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET_RESGATES).upload(storagePath, file, {
    upsert: false,
    contentType: file.type,
  })

  if (error) throw error
}

export async function confirmarResgateAnonimo(params: {
  uploadTokenId: string
  porteEstimado: string
  regiaoAproximada: string
  descricao?: string
  consentimentoLocalizacao: boolean
  latitude?: number
  longitude?: number
  versaoTermos: string
}): Promise<ConfirmarResgateResultado> {
  const contexto = {
    fluxo: 'resgate_anonimo',
    fingerprint: getOrCreateResgateFingerprint(),
    versao_termos: params.versaoTermos,
    user_agent: navigator.userAgent,
    idioma: navigator.language,
    registrado_em: new Date().toISOString(),
  }

  const { data, error } = await supabase.rpc('confirmar_resgate_anonimo', {
    p_upload_token_id: params.uploadTokenId,
    p_porte_estimado: params.porteEstimado,
    p_regiao_aproximada: params.regiaoAproximada,
    p_descricao: params.descricao ?? null,
    p_consentimento_localizacao: params.consentimentoLocalizacao,
    p_latitude: params.consentimentoLocalizacao ? params.latitude : null,
    p_longitude: params.consentimentoLocalizacao ? params.longitude : null,
    p_consentimento_contexto: contexto,
  })

  if (error) throw error
  return data as ConfirmarResgateResultado
}

export async function createResgateAutenticado(params: {
  userId: string
  organizacaoId?: string
  foto: File
  porteEstimado: string
  regiaoAproximada: string
  descricao?: string
  microchip?: string
  consentimentoLocalizacao: boolean
  latitude?: number
  longitude?: number
}): Promise<ConfirmarResgateResultado> {
  const ext = params.foto.name.split('.').pop()?.toLowerCase() || 'jpg'
  const prefix = params.organizacaoId
    ? `org/${params.organizacaoId}`
    : `user/${params.userId}`
  const registroId = crypto.randomUUID()
  const path = `${prefix}/${registroId}/foto.${ext}`

  await uploadResgatePhoto(path, params.foto)

  const contexto = {
    fluxo: params.organizacaoId ? 'resgate_orgao' : 'resgate_autenticado',
    user_id: params.userId,
    registrado_em: new Date().toISOString(),
  }

  const { data, error } = await supabase.rpc('registrar_resgate_autenticado', {
    p_foto_path: path,
    p_porte_estimado: params.porteEstimado,
    p_regiao_aproximada: params.regiaoAproximada,
    p_descricao: params.descricao ?? null,
    p_consentimento_localizacao: params.consentimentoLocalizacao,
    p_latitude: params.consentimentoLocalizacao ? params.latitude : null,
    p_longitude: params.consentimentoLocalizacao ? params.longitude : null,
    p_organizacao_id: params.organizacaoId ?? null,
    p_consentimento_contexto: contexto,
    p_microchip: params.microchip?.trim() || null,
  })

  if (error) throw error
  return data as ConfirmarResgateResultado
}

export function mapResgateError(message: string): string {
  const lower = message.toLowerCase()

  if (lower.includes('captcha')) {
    return 'CAPTCHA inválido ou expirado. Marque a verificação e tente novamente.'
  }

  if (lower.includes('p0003') || lower.includes('muitas')) {
    return 'Muitas tentativas em pouco tempo. Aguarde alguns minutos.'
  }

  if (lower.includes('upload expirado')) {
    return 'O envio da foto expirou. Refaça o CAPTCHA e envie novamente.'
  }

  if (lower.includes('região aproximada')) {
    return 'Informe a região aproximada (bairro ou cidade).'
  }

  return message || 'Não foi possível registrar o resgate.'
}

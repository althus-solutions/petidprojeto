import { supabase } from '@/lib/supabase'
import type {
  LeituraQrResultado,
  PaginaQrConfig,
  PetPublicoQr,
} from '@/types/qr-read'

const FINGERPRINT_KEY = 'petid_qr_fingerprint'

const PAGINA_QR_PADRAO: PaginaQrConfig = {
  titulo: 'Perfil do animal',
  instrucao:
    'Confira se é o animal certo. Ao confirmar o resgate, o tutor é notificado e você pode falar com ele pelo WhatsApp (se houver telefone cadastrado).',
  mensagem_contato:
    'Ao confirmar o resgate, o tutor será avisado pelo canal que ele configurou (WhatsApp, e-mail ou push).',
  texto_consentimento:
    'Autorizo compartilhar minha localização aproximada com o tutor deste pet, apenas para facilitar o reencontro.',
  versao_termos_consentimento: '1.0',
}

export function getOrCreateQrFingerprint(): string {
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

export async function fetchPaginaQrConfig(): Promise<PaginaQrConfig> {
  const { data, error } = await supabase
    .from('configuracoes_sistema')
    .select('valor')
    .eq('chave', 'pagina_qr')
    .maybeSingle()

  if (error) throw error

  const config = data?.valor as Partial<PaginaQrConfig> | undefined
  return { ...PAGINA_QR_PADRAO, ...config }
}

export async function fetchPetByQrPayload(
  qrPayload: string,
): Promise<PetPublicoQr> {
  const { data, error } = await supabase.rpc('obter_pet_por_qr', {
    p_qr_payload: qrPayload,
  })

  if (error) throw error
  return data as PetPublicoQr
}

export async function getPetPhotoUrl(
  fotoPath: string | null,
): Promise<string | null> {
  if (!fotoPath) return null

  const { data, error } = await supabase.storage
    .from('pets')
    .createSignedUrl(fotoPath, 300)

  if (error) return null
  return data.signedUrl
}

export async function registrarLeituraQr(params: {
  qrPayload: string
  consentimentoLocalizacao: boolean
  latitude?: number
  longitude?: number
  versaoTermos: string
}): Promise<LeituraQrResultado> {
  const contexto = {
    fluxo: 'confirmar_resgate_tag',
    fingerprint: getOrCreateQrFingerprint(),
    versao_termos: params.versaoTermos,
    user_agent: navigator.userAgent,
    idioma: navigator.language,
    registrado_em: new Date().toISOString(),
  }

  const { data, error } = await supabase.rpc('registrar_leitura_qr', {
    p_qr_payload: params.qrPayload,
    p_consentimento_localizacao: params.consentimentoLocalizacao,
    p_latitude: params.consentimentoLocalizacao ? params.latitude : null,
    p_longitude: params.consentimentoLocalizacao ? params.longitude : null,
    p_consentimento_contexto: contexto,
  })

  if (error) throw error
  return data as LeituraQrResultado
}

/** Monta URL wa.me a partir de telefone E.164 (só dígitos). */
export function buildWhatsAppUrl(
  telefoneE164: string,
  mensagem?: string,
): string {
  const digits = telefoneE164.replace(/\D/g, '')
  const base = `https://wa.me/${digits}`
  if (!mensagem) return base
  return `${base}?text=${encodeURIComponent(mensagem)}`
}

export { getGeolocation } from '@/lib/geolocation'

export function mapQrErrorMessage(message: string): string {
  const lower = message.toLowerCase()

  if (lower.includes('p0002') || lower.includes('não encontrado')) {
    return 'QR Code não reconhecido. Verifique se a etiqueta está legível.'
  }

  if (lower.includes('p0003') || lower.includes('muitas')) {
    return 'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.'
  }

  if (lower.includes('p0001') || lower.includes('inválido')) {
    return 'Dados inválidos. Atualize a página e tente de novo.'
  }

  return message || 'Não foi possível completar a operação. Tente novamente.'
}

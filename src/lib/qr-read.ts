import { supabase } from '@/lib/supabase'
import type {
  LeituraQrResultado,
  PaginaQrConfig,
  PetPublicoQr,
} from '@/types/qr-read'

const FINGERPRINT_KEY = 'petid_qr_fingerprint'

const PAGINA_QR_PADRAO: PaginaQrConfig = {
  titulo: 'Você encontrou este pet?',
  instrucao:
    'Confira se é o animal certo. Aceite os termos e toque em Confirmar Resgate — em seguida pedimos a localização em um passo separado.',
  mensagem_contato:
    'Ao confirmar o resgate, o tutor será avisado pela MyPetID (se houver ocorrência de perda aberta).',
  /** Usado só no contexto auditável / modal — não é checkbox na página. */
  texto_consentimento:
    'Compartilho minha localização aproximada com o tutor deste pet para facilitar o reencontro.',
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

  const pet = data as PetPublicoQr & { foto_paths?: unknown }
  pet.foto_paths = normalizeFotoPaths(pet.foto_paths, pet.foto_path ?? null)
  return pet
}

/** Normaliza foto_paths vindos do PostgREST/jsonb (array, string JSON, etc.). */
function normalizeFotoPaths(
  raw: unknown,
  fallback: string | null,
): string[] {
  let arr: unknown[] = []
  if (typeof raw === 'string') {
    try {
      const parsed: unknown = JSON.parse(raw)
      arr = Array.isArray(parsed) ? parsed : []
    } catch {
      arr = []
    }
  } else if (Array.isArray(raw)) {
    arr = raw
  }

  const paths = arr
    .map((p) => (typeof p === 'string' ? normalizeStoragePath(p) : null))
    .filter((p): p is string => Boolean(p))

  const unique = [...new Set(paths)]
  if (unique.length > 0) return unique
  const fb = normalizeStoragePath(fallback)
  if (fb) return [fb]
  return []
}

/** Normaliza path gravado no banco para o object name do bucket `pets`. */
export function normalizeStoragePath(fotoPath: string | null | undefined): string | null {
  if (!fotoPath) return null
  let path = fotoPath.trim()
  if (!path) return null

  try {
    path = decodeURIComponent(path)
  } catch {
    // mantém path original se não for URI válida
  }

  path = path.replace(/^\/+/, '')
  // Alguns registros antigos podem ter prefixo do bucket
  path = path.replace(/^pets\//i, '')
  // URL completa acidental → extrai path após /pets/
  const fromUrl = path.match(/\/storage\/v1\/object\/(?:public|sign)\/pets\/(.+?)(?:\?|$)/i)
  if (fromUrl?.[1]) {
    path = decodeURIComponent(fromUrl[1])
  }

  path = path.split('?')[0]?.trim() ?? ''
  return path || null
}

export async function getPetPhotoUrl(
  fotoPath: string | null,
): Promise<string | null> {
  const path = normalizeStoragePath(fotoPath)
  if (!path) return null

  const { data, error } = await supabase.storage
    .from('pets')
    .createSignedUrl(path, 3600)

  if (!error && data?.signedUrl) return data.signedUrl

  if (import.meta.env.DEV && error) {
    console.warn('[pet-foto] createSignedUrl falhou', { path, error })
  }

  return null
}

/** Resolve paths da galeria pública (RPC + fallback capa). */
export function resolvePetFotoPaths(pet: PetPublicoQr): string[] {
  return normalizeFotoPaths(pet.foto_paths, pet.foto_path ?? null)
}

export async function getPetPhotoUrls(
  fotoPaths: string[],
): Promise<string[]> {
  const unique = [
    ...new Set(
      fotoPaths
        .map((p) => normalizeStoragePath(p))
        .filter((p): p is string => Boolean(p)),
    ),
  ]
  if (unique.length === 0) return []

  // Batch primeiro (menos round-trips); fallback individual se a API falhar
  const { data: batch, error: batchError } = await supabase.storage
    .from('pets')
    .createSignedUrls(unique, 3600)

  if (import.meta.env.DEV && batchError) {
    console.warn('[pet-foto] createSignedUrls falhou', { unique, batchError })
  }

  if (!batchError && batch?.length) {
    const fromBatch = batch
      .map((row) => row.signedUrl)
      .filter((u): u is string => Boolean(u))
    if (fromBatch.length > 0) return fromBatch

    if (import.meta.env.DEV) {
      const falhas = batch
        .filter((row) => !row.signedUrl)
        .map((row) => ({ path: row.path, error: row.error }))
      if (falhas.length > 0) {
        console.warn(
          '[pet-foto] signed URLs vazias — aplique migration 041 no Supabase',
          falhas,
        )
      }
    }
  }

  const urls = await Promise.all(unique.map((path) => getPetPhotoUrl(path)))
  return urls.filter((u): u is string => Boolean(u))
}

export async function registrarLeituraQr(params: {
  qrPayload: string
  consentimentoLocalizacao: boolean
  latitude?: number
  longitude?: number
  /** Endereço obtido por reverse geocode no momento da leitura. */
  enderecoTexto?: string | null
  versaoTermos: string
}): Promise<LeituraQrResultado> {
  const contexto = {
    fluxo: 'confirmar_resgate_tag',
    fingerprint: getOrCreateQrFingerprint(),
    versao_termos: params.versaoTermos,
    user_agent: navigator.userAgent,
    idioma: navigator.language,
    registrado_em: new Date().toISOString(),
    endereco_texto: params.consentimentoLocalizacao
      ? (params.enderecoTexto ?? null)
      : null,
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

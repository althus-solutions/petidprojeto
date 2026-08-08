import { supabase } from '@/lib/supabase'
import type {
  AbrirOcorrenciaResultado,
  OcorrenciaAbertaMapa,
  OcorrenciaPerdido,
} from '@/types/ocorrencia'

export async function listOcorrenciasByAnimal(
  animalId: string,
): Promise<OcorrenciaPerdido[]> {
  const { data, error } = await supabase
    .from('ocorrencias_perdido')
    .select('*')
    .eq('animal_id', animalId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

export async function listOcorrenciasAbertasTutor(): Promise<OcorrenciaAbertaMapa[]> {
  const { data, error } = await supabase.rpc('listar_ocorrencias_abertas_tutor')

  if (error) throw error
  return (data as OcorrenciaAbertaMapa[]) ?? []
}

export async function abrirOcorrenciaPerdido(params: {
  animalId: string
  dataPerda: string
  latitude: number
  longitude: number
  enderecoAproximado?: string
  retroativa: boolean
}): Promise<AbrirOcorrenciaResultado> {
  const contexto = {
    fluxo: 'ocorrencia_perdido',
    user_agent: navigator.userAgent,
    registrado_em: new Date().toISOString(),
  }

  const { data, error } = await supabase.rpc('abrir_ocorrencia_perdido', {
    p_animal_id: params.animalId,
    p_data_perda: params.dataPerda,
    p_latitude: params.latitude,
    p_longitude: params.longitude,
    p_endereco_aproximado: params.enderecoAproximado ?? null,
    p_retroativa: params.retroativa,
    p_consentimento_contexto: contexto,
  })

  if (error) throw error
  return data as AbrirOcorrenciaResultado
}

export function mapOcorrenciaError(message: string): string {
  const lower = message.toLowerCase()

  if (lower.includes('já existe uma ocorrência aberta')) {
    return 'Este pet já tem uma ocorrência de perda em aberto.'
  }

  if (lower.includes('p0002') || lower.includes('não encontrado')) {
    return 'Pet não encontrado.'
  }

  if (lower.includes('permissão')) {
    return 'Você não tem permissão para esta ação.'
  }

  return message || 'Não foi possível abrir a ocorrência.'
}

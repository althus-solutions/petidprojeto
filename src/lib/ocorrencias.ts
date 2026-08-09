import { supabase } from '@/lib/supabase'
import { validatePetFotoFile } from '@/lib/pets'
import type {
  AbrirOcorrenciaInput,
  AbrirOcorrenciaResultado,
  OcorrenciaAbertaMapa,
  OcorrenciaPerdido,
} from '@/types/ocorrencia'

const BUCKET_PETS = 'pets'

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

export async function listOcorrenciasAbertasTutor(): Promise<
  OcorrenciaAbertaMapa[]
> {
  const { data, error } = await supabase.rpc('listar_ocorrencias_abertas_tutor')

  if (error) throw error
  return (data as OcorrenciaAbertaMapa[]) ?? []
}

export interface ReencontroResultado {
  ok: boolean
  ocorrencia_id: string
  animal_id: string
  animal_nome: string
  status: 'reencontrado'
}

/** Tutor confirma que o pet foi encontrado e encerra a ocorrência. */
export async function registrarReencontroTutor(params: {
  ocorrenciaId: string
  notas?: string | null
}): Promise<ReencontroResultado> {
  const { data, error } = await supabase.rpc('registrar_reencontro_tutor', {
    p_ocorrencia_id: params.ocorrenciaId,
    p_notas: params.notas ?? null,
  })

  if (error) throw error
  return data as ReencontroResultado
}

export function mapReencontroError(message: string): string {
  const lower = message.toLowerCase()

  if (lower.includes('já está encerrada')) {
    return 'Esta ocorrência já foi encerrada.'
  }

  if (lower.includes('não encontrada') || lower.includes('p0002')) {
    return 'Ocorrência não encontrada.'
  }

  if (
    lower.includes('could not find the function') ||
    lower.includes('schema cache')
  ) {
    return 'Atualize o banco: aplique a migration 031_registrar_reencontro_tutor.sql.'
  }

  if (lower.includes('permissão') || lower.includes('permission')) {
    return 'Você não tem permissão para esta ação.'
  }

  return message || 'Não foi possível registrar o reencontro.'
}

/** Foto opcional “como estava no dia” — path no bucket pets. */
export async function uploadFotoDiaOcorrencia(
  tutorId: string,
  animalId: string,
  file: File,
): Promise<string> {
  validatePetFotoFile(file)
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `${tutorId}/${animalId}/ocorrencias/dia_${Date.now()}.${ext}`

  const { error } = await supabase.storage.from(BUCKET_PETS).upload(path, file, {
    upsert: false,
    contentType: file.type || 'image/jpeg',
  })

  if (error) throw error
  return path
}

export async function abrirOcorrenciaPerdido(
  params: AbrirOcorrenciaInput,
): Promise<AbrirOcorrenciaResultado> {
  const contexto = {
    fluxo: 'ocorrencia_perdido',
    user_agent: navigator.userAgent,
    registrado_em: new Date().toISOString(),
    fonte_localizacao: params.fonteLocalizacao,
    raio_busca_km: params.raioBuscaKm,
  }

  const { data, error } = await supabase.rpc('abrir_ocorrencia_perdido', {
    p_animal_id: params.animalId,
    p_data_perda: params.dataPerda,
    p_latitude: params.latitude,
    p_longitude: params.longitude,
    p_endereco_aproximado: params.enderecoAproximado ?? null,
    p_retroativa: params.retroativa,
    p_consentimento_contexto: contexto,
    p_horario_perda: params.horarioDesconhecido
      ? null
      : (params.horarioPerda ?? null),
    p_horario_desconhecido: params.horarioDesconhecido,
    p_com_identificacao: params.comIdentificacao,
    p_circunstancias: params.circunstancias ?? null,
    p_foto_dia_path: params.fotoDiaPath ?? null,
    p_raio_busca_km: params.raioBuscaKm,
    p_contato_alternativo: params.contatoAlternativo ?? null,
    p_fonte_localizacao: params.fonteLocalizacao,
    p_consentimento_ocorrencia: params.consentimentoOcorrencia,
    p_cidade: params.cidade,
    p_bairro: params.bairro,
    p_estado: params.estado,
  })

  if (error) throw error
  return data as AbrirOcorrenciaResultado
}

export function mapOcorrenciaError(message: string): string {
  const lower = message.toLowerCase()

  if (lower.includes('já existe uma ocorrência aberta')) {
    return 'Este pet já tem uma ocorrência de perda em aberto.'
  }

  if (lower.includes('consentimento')) {
    return 'Marque o consentimento para compartilhar este caso de busca.'
  }

  if (
    lower.includes('estado') ||
    lower.includes('cidade e bairro') ||
    lower.includes('endereço confirmado') ||
    lower.includes('selecione')
  ) {
    return 'Selecione estado (UF), cidade e bairro nas listas (ou use coordenadas manuais).'
  }

  if (lower.includes('coordenadas')) {
    return 'Latitude/longitude inválidas. Use valores entre -90…90 e -180…180.'
  }

  if (lower.includes('p0002') || lower.includes('não encontrado')) {
    return 'Pet não encontrado.'
  }

  if (lower.includes('permissão')) {
    return 'Você não tem permissão para esta ação.'
  }

  if (lower.includes('could not find the function') || lower.includes('schema cache')) {
    return 'Atualize o banco: aplique a migration 022_ocorrencia_perdido_enriquecida.sql.'
  }

  return message || 'Não foi possível abrir a ocorrência.'
}

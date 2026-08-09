import { geocodeEnderecoCompleto } from '@/lib/geocode'
import { supabase } from '@/lib/supabase'
import type { TutorEndereco } from '@/types/tutor-endereco'

/** Tipo fixo na tabela (unique tutor_id+tipo). UI não expõe isso. */
const TIPO_UNICO = 'residencia'

function mapRow(row: Record<string, unknown>): TutorEndereco {
  return {
    id: row.id as string,
    cep: (row.cep as string | null) ?? null,
    logradouro: row.logradouro as string,
    numero: (row.numero as string | null) ?? null,
    complemento: (row.complemento as string | null) ?? null,
    bairro: (row.bairro as string | null) ?? null,
    cidade: row.cidade as string,
    estado: String(row.estado).toUpperCase(),
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
  }
}

const SELECT_COLS =
  'id, cep, logradouro, numero, complemento, bairro, cidade, estado, latitude, longitude'

function missingTableError(error: { code?: string; message: string }) {
  return (
    error.code === '42P01' ||
    error.message.toLowerCase().includes('tutor_enderecos')
  )
}

export async function getTutorEndereco(
  tutorId: string,
): Promise<TutorEndereco | null> {
  const { data, error } = await supabase
    .from('tutor_enderecos')
    .select(SELECT_COLS)
    .eq('tutor_id', tutorId)
    .order('tipo', { ascending: true })
    .limit(1)

  if (error) {
    if (missingTableError(error)) {
      throw new Error(
        'Endereço do perfil ainda não está disponível. Aplique a migration 027_tutor_enderecos_leitura_texto.sql no Supabase.',
      )
    }
    throw error
  }

  const row = data?.[0]
  return row ? mapRow(row) : null
}

export async function upsertTutorEndereco(
  tutorId: string,
  input: Omit<TutorEndereco, 'id' | 'latitude' | 'longitude'> & {
    latitude?: number
    longitude?: number
  },
): Promise<TutorEndereco> {
  const logradouro = input.logradouro.trim()
  const cidade = input.cidade.trim()
  const estado = input.estado.trim().toUpperCase()
  const bairro = input.bairro?.trim() || null
  const numero = input.numero?.trim() || null

  if (logradouro.length < 2) {
    throw new Error('Informe a rua / logradouro.')
  }
  if (cidade.length < 2 || estado.length !== 2) {
    throw new Error('Selecione cidade e estado (UF).')
  }

  let latitude = input.latitude
  let longitude = input.longitude

  if (
    typeof latitude !== 'number' ||
    typeof longitude !== 'number' ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    const geo = await geocodeEnderecoCompleto({
      logradouro,
      numero: numero ?? undefined,
      bairro: bairro ?? undefined,
      cidade,
      estado,
    })
    if (!geo) {
      throw new Error(
        'Não foi possível localizar este endereço no mapa. Confira rua, número e cidade.',
      )
    }
    latitude = geo.latitude
    longitude = geo.longitude
  }

  // Garante um único endereço: remove extras (ex.: trabalho antigo)
  await supabase.from('tutor_enderecos').delete().eq('tutor_id', tutorId)

  const payload = {
    tutor_id: tutorId,
    tipo: TIPO_UNICO,
    cep: input.cep?.trim() || null,
    logradouro,
    numero,
    complemento: input.complemento?.trim() || null,
    bairro,
    cidade,
    estado,
    latitude,
    longitude,
    consentimento_em: new Date().toISOString(),
    consentimento_contexto: {
      finalidade: 'mapa_privado_tutor',
      tela: '/tutor/perfil',
      nao_compartilhado_com_finder: true,
    },
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('tutor_enderecos')
    .insert(payload)
    .select(SELECT_COLS)
    .single()

  if (error) {
    if (missingTableError(error)) {
      throw new Error(
        'Endereço do perfil ainda não está disponível. Aplique a migration 027_tutor_enderecos_leitura_texto.sql no Supabase.',
      )
    }
    throw error
  }

  return mapRow(data)
}

export async function deleteTutorEndereco(tutorId: string): Promise<void> {
  const { error } = await supabase
    .from('tutor_enderecos')
    .delete()
    .eq('tutor_id', tutorId)

  if (error) throw error
}

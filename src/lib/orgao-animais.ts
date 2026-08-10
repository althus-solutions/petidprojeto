import { supabase } from '@/lib/supabase'
import type {
  AnimalOrganizacao,
  AnimalOrganizacaoStatus,
  CriarAnimalOrganizacaoInput,
} from '@/types/orgao-animais'

const BUCKET_RESGATES = 'resgates'

export const STATUS_ANIMAL_ORG: {
  value: AnimalOrganizacaoStatus
  label: string
}[] = [
  { value: 'sob_cuidados', label: 'Sob cuidados' },
  { value: 'disponivel_adocao', label: 'Disponível para adoção' },
  { value: 'devolvido', label: 'Devolvido ao tutor' },
  { value: 'transferido', label: 'Transferido' },
  { value: 'obito', label: 'Óbito' },
]

export function labelStatusAnimalOrg(status: string): string {
  return STATUS_ANIMAL_ORG.find((s) => s.value === status)?.label ?? status
}

export async function listarAnimaisOrganizacao(
  organizacaoId?: string | null,
): Promise<AnimalOrganizacao[]> {
  const { data, error } = await supabase.rpc('listar_animais_organizacao', {
    p_organizacao_id: organizacaoId ?? null,
    p_limite: 200,
  })

  if (error) throw error
  return (data ?? []) as AnimalOrganizacao[]
}

export async function getResgatePhotoSignedUrl(
  storagePath: string | null | undefined,
  expiresIn = 3600,
): Promise<string | null> {
  if (!storagePath) return null
  if (storagePath.startsWith('http://') || storagePath.startsWith('https://')) {
    return storagePath
  }
  const { data, error } = await supabase.storage
    .from(BUCKET_RESGATES)
    .createSignedUrl(storagePath, expiresIn)
  if (error) return null
  return data.signedUrl
}

export async function criarAnimalOrganizacao(
  input: CriarAnimalOrganizacaoInput,
  organizacaoId: string,
): Promise<{ id: string }> {
  let fotoPath: string | null = null

  if (input.foto) {
    const ext = input.foto.name.split('.').pop()?.toLowerCase() || 'jpg'
    const id = crypto.randomUUID()
    fotoPath = `org/${organizacaoId}/abrigo/${id}/foto.${ext}`
    const { error: uploadError } = await supabase.storage
      .from(BUCKET_RESGATES)
      .upload(fotoPath, input.foto, {
        upsert: false,
        contentType: input.foto.type,
      })
    if (uploadError) throw uploadError
  }

  const sexoRaw = (input.sexo ?? '').trim().toLowerCase()
  let sexo: string | null = null
  if (sexoRaw === 'macho') sexo = 'macho'
  else if (sexoRaw === 'fêmea' || sexoRaw === 'femea') sexo = 'femea'
  else if (sexoRaw === 'não sei' || sexoRaw === 'nao sei' || sexoRaw === 'nao_sei')
    sexo = 'nao_sei'

  const { data, error } = await supabase.rpc('criar_animal_organizacao', {
    p_nome: input.nome?.trim() || null,
    p_especie: input.especie?.trim() || null,
    p_raca: input.raca?.trim() || null,
    p_porte: input.porte?.trim() || null,
    p_cor: input.cor?.trim() || null,
    p_sexo: sexo,
    p_caracteristicas: input.caracteristicas?.trim() || null,
    p_microchip: input.microchip?.trim() || null,
    p_foto_path: fotoPath,
    p_status: input.status ?? 'sob_cuidados',
  })

  if (error) throw error
  return data as { id: string }
}

export function mapOrgaoAnimalError(message: string): string {
  const lower = message.toLowerCase()
  if (lower.includes('microchip já')) {
    return 'Este número de microchip já está cadastrado na plataforma.'
  }
  if (lower.includes('sem permissão') || lower.includes('outra organização')) {
    return 'Você não tem permissão para ver ou editar este inventário.'
  }
  return message || 'Não foi possível salvar o animal.'
}

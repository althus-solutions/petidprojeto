import { supabase } from '@/lib/supabase'
import type { CanalNotificacao } from '@/types/auth'
import type { TutorContato, TutorPerfilForm } from '@/types/tutor-perfil'

const BUCKET_PETS = 'pets'

export async function uploadTutorPhoto(
  tutorId: string,
  file: File,
): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `${tutorId}/perfil/foto.${ext}`

  const { error } = await supabase.storage.from(BUCKET_PETS).upload(path, file, {
    upsert: true,
    contentType: file.type || 'image/jpeg',
  })

  if (error) throw error
  return path
}

export async function getTutorPhotoSignedUrl(
  storagePath: string,
  expiresIn = 3600,
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(BUCKET_PETS)
    .createSignedUrl(storagePath, expiresIn)

  if (error) return null
  return data.signedUrl
}

export async function listTutorContatos(tutorId: string): Promise<TutorContato[]> {
  const { data, error } = await supabase
    .from('tutor_contatos')
    .select('id, telefone, rotulo, principal')
    .eq('tutor_id', tutorId)
    .order('principal', { ascending: false })
    .order('created_at', { ascending: true })

  if (error) throw error

  return (data ?? []).map((row) => ({
    id: row.id as string,
    telefone: row.telefone as string,
    rotulo: (row.rotulo as string | null) ?? null,
    principal: Boolean(row.principal),
  }))
}

export async function salvarPerfilTutor(
  tutorId: string,
  input: TutorPerfilForm,
): Promise<{
  contatos: TutorContato[]
  foto_url: string | null
}> {
  const contatosPayload = input.contatos
    .map((c) => ({
      telefone: c.telefone.trim(),
      rotulo: c.rotulo?.trim() || null,
      principal: c.principal,
    }))
    .filter((c) => c.telefone.length > 0)

  const { data, error } = await supabase.rpc('salvar_perfil_tutor', {
    p_nome: input.nome.trim(),
    p_canal_notificacao: input.canal_notificacao_preferido,
    p_contatos: contatosPayload,
  })

  if (error) throw error

  const result = data as {
    tutor_id?: string
    contatos?: Array<{
      id: string
      telefone: string
      rotulo: string | null
      principal: boolean
    }>
  }

  let fotoUrl = input.foto_url ?? null

  if (input.fotoFile) {
    fotoUrl = await uploadTutorPhoto(tutorId, input.fotoFile)
    const { error: fotoError } = await supabase
      .from('tutores')
      .update({ foto_url: fotoUrl })
      .eq('id', tutorId)

    if (fotoError) {
      if (
        fotoError.code === '42703' ||
        fotoError.message.toLowerCase().includes('foto_url')
      ) {
        throw new Error(
          'A foto de perfil ainda não está disponível neste ambiente. Aplique a migration 017_tutor_foto_perfil.sql no Supabase.',
        )
      }
      throw fotoError
    }
  }

  return {
    contatos: (result.contatos ?? []).map((c) => ({
      id: c.id,
      telefone: c.telefone,
      rotulo: c.rotulo,
      principal: c.principal,
    })),
    foto_url: fotoUrl,
  }
}

export function mapPerfilError(message: string): string {
  const lower = message.toLowerCase()

  if (lower.includes('p0002') || lower.includes('não encontrado')) {
    return 'Perfil de tutor não encontrado. Faça login novamente.'
  }

  if (lower.includes('exatamente um') || lower.includes('principal')) {
    return 'Marque exatamente um número como principal para notificações.'
  }

  if (lower.includes('ao menos um') || lower.includes('pelo menos')) {
    return 'Informe ao menos um telefone de contato.'
  }

  if (lower.includes('brasileiro') || lower.includes('telefone')) {
    return 'Use um telefone brasileiro válido com DDD (ex.: 11999998888).'
  }

  if (lower.includes('canal')) {
    return 'Selecione um canal de notificação válido.'
  }

  if (lower.includes('nome')) {
    return 'Informe um nome com pelo menos 2 caracteres.'
  }

  if (
    lower.includes('storage') ||
    lower.includes('mime') ||
    lower.includes('payload too large') ||
    lower.includes('file size')
  ) {
    return 'Não foi possível enviar a foto. Use JPG, PNG ou WebP até o tamanho permitido.'
  }

  return message || 'Não foi possível salvar o perfil. Tente novamente.'
}

export const CANAIS_NOTIFICACAO: { value: CanalNotificacao; label: string }[] = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email', label: 'E-mail' },
  { value: 'push', label: 'Push (navegador)' },
]

import { supabase } from '@/lib/supabase'
import type { CanalNotificacao } from '@/types/auth'
import type { TutorContato, TutorPerfilForm } from '@/types/tutor-perfil'

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

export async function salvarPerfilTutor(input: TutorPerfilForm): Promise<{
  contatos: TutorContato[]
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
    contatos?: Array<{
      id: string
      telefone: string
      rotulo: string | null
      principal: boolean
    }>
  }

  return {
    contatos: (result.contatos ?? []).map((c) => ({
      id: c.id,
      telefone: c.telefone,
      rotulo: c.rotulo,
      principal: c.principal,
    })),
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

  return message || 'Não foi possível salvar o perfil. Tente novamente.'
}

export const CANAIS_NOTIFICACAO: { value: CanalNotificacao; label: string }[] = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email', label: 'E-mail' },
  { value: 'push', label: 'Push (navegador)' },
]

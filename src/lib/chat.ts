import { supabase } from '@/lib/supabase'
import { getOrCreateQrFingerprint } from '@/lib/qr-read'
import type { ChatConversaResumo, ChatMensagem } from '@/types/chat'

export function getChatFingerprint(): string {
  return getOrCreateQrFingerprint()
}

export async function abrirConversaPet(params: {
  qrPayload: string
  leituraId?: string | null
}): Promise<{ conversa_id: string; animal_nome: string }> {
  const { data, error } = await supabase.rpc('abrir_conversa_pet', {
    p_qr_payload: params.qrPayload,
    p_fingerprint: getChatFingerprint(),
    p_leitura_id: params.leituraId ?? null,
  })
  if (error) throw error
  return data as { conversa_id: string; animal_nome: string }
}

export async function listarConversasFinder(): Promise<ChatConversaResumo[]> {
  const { data, error } = await supabase.rpc('listar_conversas_finder', {
    p_fingerprint: getChatFingerprint(),
  })
  if (error) throw error
  return (data ?? []) as ChatConversaResumo[]
}

export async function listarConversasTutor(): Promise<ChatConversaResumo[]> {
  const { data, error } = await supabase
    .from('conversas')
    .select(
      `
      id,
      animal_id,
      updated_at,
      animais!inner ( nome )
    `,
    )
    .order('updated_at', { ascending: false })

  if (error) throw error

  const rows = data ?? []
  const result: ChatConversaResumo[] = []

  for (const row of rows) {
    const animal = row.animais as unknown as { nome: string } | { nome: string }[]
    const nome = Array.isArray(animal) ? animal[0]?.nome : animal?.nome

    const { count } = await supabase
      .from('mensagens')
      .select('id', { count: 'exact', head: true })
      .eq('conversa_id', row.id)
      .eq('autor', 'finder')
      .is('lida_em', null)

    const { data: last } = await supabase
      .from('mensagens')
      .select('corpo')
      .eq('conversa_id', row.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    result.push({
      id: row.id as string,
      animal_id: row.animal_id as string,
      animal_nome: nome ?? 'Pet',
      updated_at: row.updated_at as string,
      nao_lidas: count ?? 0,
      ultima_mensagem: last?.corpo ?? null,
    })
  }

  return result
}

export async function listarMensagensFinder(
  conversaId: string,
): Promise<ChatMensagem[]> {
  const { data, error } = await supabase.rpc('listar_mensagens_finder', {
    p_conversa_id: conversaId,
    p_fingerprint: getChatFingerprint(),
  })
  if (error) throw error
  return (data ?? []) as ChatMensagem[]
}

export async function listarMensagensTutor(
  conversaId: string,
): Promise<ChatMensagem[]> {
  await supabase.rpc('marcar_mensagens_lidas_tutor', {
    p_conversa_id: conversaId,
  })

  const { data, error } = await supabase
    .from('mensagens')
    .select('id, autor, corpo, created_at, lida_em')
    .eq('conversa_id', conversaId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data ?? []) as ChatMensagem[]
}

export async function enviarMensagemFinder(
  conversaId: string,
  corpo: string,
): Promise<ChatMensagem> {
  const { data, error } = await supabase.rpc('enviar_mensagem_finder', {
    p_conversa_id: conversaId,
    p_fingerprint: getChatFingerprint(),
    p_corpo: corpo,
  })
  if (error) throw error
  return data as ChatMensagem
}

export async function enviarMensagemTutor(
  conversaId: string,
  corpo: string,
): Promise<ChatMensagem> {
  const { data, error } = await supabase
    .from('mensagens')
    .insert({
      conversa_id: conversaId,
      autor: 'tutor',
      corpo: corpo.trim(),
    })
    .select('id, autor, corpo, created_at, lida_em')
    .single()

  if (error) throw error
  return data as ChatMensagem
}

export async function contarNaoLidasFinder(): Promise<number> {
  const { data, error } = await supabase.rpc('contar_nao_lidas_finder', {
    p_fingerprint: getChatFingerprint(),
  })
  if (error) return 0
  return Number(data ?? 0)
}

export async function contarNaoLidasTutor(): Promise<number> {
  const { data, error } = await supabase.rpc('contar_nao_lidas_tutor')
  if (error) return 0
  return Number(data ?? 0)
}

import { supabase } from '@/lib/supabase'
import { getOrCreateQrFingerprint } from '@/lib/qr-read'
import type {
  ChatConversaResumo,
  ChatMensagem,
  ChatMensagemTipo,
} from '@/types/chat'
import { previewUltimaMensagem } from '@/types/chat'

const BUCKET_CHAT = 'chat-midia'

export function getChatFingerprint(): string {
  return getOrCreateQrFingerprint()
}

export async function abrirConversaPet(params: {
  qrPayload: string
  leituraId?: string | null
}): Promise<{
  conversa_id: string
  animal_nome: string
  finder_rotulo: number | null
}> {
  const { data, error } = await supabase.rpc('abrir_conversa_pet', {
    p_qr_payload: params.qrPayload,
    p_fingerprint: getChatFingerprint(),
    p_leitura_id: params.leituraId ?? null,
  })
  if (error) throw error
  const row = data as {
    conversa_id: string
    animal_nome: string
    finder_rotulo?: number | null
  }
  return {
    conversa_id: row.conversa_id,
    animal_nome: row.animal_nome,
    finder_rotulo: row.finder_rotulo ?? null,
  }
}

export async function listarConversasFinder(): Promise<ChatConversaResumo[]> {
  const { data, error } = await supabase.rpc('listar_conversas_finder', {
    p_fingerprint: getChatFingerprint(),
  })
  if (error) throw error
  return ((data ?? []) as ChatConversaResumo[]).map((c) => ({
    ...c,
    finder_rotulo: c.finder_rotulo ?? null,
  }))
}

export async function listarConversasTutor(): Promise<ChatConversaResumo[]> {
  const { data, error } = await supabase
    .from('conversas')
    .select(
      `
      id,
      animal_id,
      finder_rotulo,
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
      .select('corpo, tipo')
      .eq('conversa_id', row.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    result.push({
      id: row.id as string,
      animal_id: row.animal_id as string,
      animal_nome: nome ?? 'Pet',
      finder_rotulo: (row.finder_rotulo as number | null) ?? null,
      updated_at: row.updated_at as string,
      nao_lidas: count ?? 0,
      ultima_mensagem: last
        ? previewUltimaMensagem({
            id: '',
            autor: 'finder',
            tipo: (last.tipo as ChatMensagemTipo) ?? 'texto',
            corpo: last.corpo as string,
            created_at: '',
          })
        : null,
    })
  }

  return result
}

async function attachMidiaUrls(msgs: ChatMensagem[]): Promise<ChatMensagem[]> {
  return Promise.all(
    msgs.map(async (m) => {
      if (!m.midia_path) return { ...m, tipo: m.tipo ?? 'texto' }
      const url = await getChatMidiaSignedUrl(m.midia_path)
      return { ...m, tipo: m.tipo ?? 'texto', midia_url: url }
    }),
  )
}

export async function getChatMidiaSignedUrl(
  storagePath: string,
  expiresIn = 3600,
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(BUCKET_CHAT)
    .createSignedUrl(storagePath, expiresIn)
  if (error) return null
  return data.signedUrl
}

export async function listarMensagensFinder(
  conversaId: string,
): Promise<ChatMensagem[]> {
  const { data, error } = await supabase.rpc('listar_mensagens_finder', {
    p_conversa_id: conversaId,
    p_fingerprint: getChatFingerprint(),
  })
  if (error) throw error
  return attachMidiaUrls((data ?? []) as ChatMensagem[])
}

export async function listarMensagensTutor(
  conversaId: string,
): Promise<ChatMensagem[]> {
  await supabase.rpc('marcar_mensagens_lidas_tutor', {
    p_conversa_id: conversaId,
  })

  const { data, error } = await supabase
    .from('mensagens')
    .select('id, autor, tipo, corpo, midia_path, created_at, lida_em')
    .eq('conversa_id', conversaId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return attachMidiaUrls((data ?? []) as ChatMensagem[])
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
  return { ...(data as ChatMensagem), tipo: 'texto' }
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
      tipo: 'texto',
      corpo: corpo.trim(),
    })
    .select('id, autor, tipo, corpo, midia_path, created_at, lida_em')
    .single()

  if (error) throw error
  return data as ChatMensagem
}

export async function enviarMidiaFinder(
  conversaId: string,
  file: File,
  tipo: 'imagem' | 'audio',
  caption?: string,
): Promise<ChatMensagem> {
  const ext =
    file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') ||
    (tipo === 'imagem' ? 'jpg' : 'webm')

  const { data: prep, error: prepError } = await supabase.rpc(
    'preparar_upload_chat_midia',
    {
      p_conversa_id: conversaId,
      p_fingerprint: getChatFingerprint(),
      p_tipo: tipo,
      p_extensao: ext,
    },
  )
  if (prepError) throw prepError

  const token = prep as { upload_token_id: string; storage_path: string }
  const { error: upError } = await supabase.storage
    .from(BUCKET_CHAT)
    .upload(token.storage_path, file, {
      upsert: false,
      contentType: file.type || undefined,
    })
  if (upError) throw upError

  const { data, error } = await supabase.rpc('enviar_mensagem_midia_finder', {
    p_conversa_id: conversaId,
    p_fingerprint: getChatFingerprint(),
    p_upload_token_id: token.upload_token_id,
    p_caption: caption ?? null,
  })
  if (error) throw error

  const msg = data as ChatMensagem
  return {
    ...msg,
    midia_url: await getChatMidiaSignedUrl(msg.midia_path ?? token.storage_path),
  }
}

export async function enviarMidiaTutor(
  conversaId: string,
  file: File,
  tipo: 'imagem' | 'audio',
  caption?: string,
): Promise<ChatMensagem> {
  const ext =
    file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') ||
    (tipo === 'imagem' ? 'jpg' : 'webm')
  const path = `${conversaId}/${crypto.randomUUID()}.${ext}`

  const { error: upError } = await supabase.storage
    .from(BUCKET_CHAT)
    .upload(path, file, {
      upsert: false,
      contentType: file.type || undefined,
    })
  if (upError) throw upError

  const { data, error } = await supabase
    .from('mensagens')
    .insert({
      conversa_id: conversaId,
      autor: 'tutor',
      tipo,
      corpo: caption?.trim() || (tipo === 'imagem' ? 'Foto' : 'Áudio'),
      midia_path: path,
    })
    .select('id, autor, tipo, corpo, midia_path, created_at, lida_em')
    .single()

  if (error) throw error
  return {
    ...(data as ChatMensagem),
    midia_url: await getChatMidiaSignedUrl(path),
  }
}

export async function enviarPedidoLigacaoFinder(
  conversaId: string,
): Promise<ChatMensagem> {
  const { data, error } = await supabase.rpc('enviar_mensagem_chamada_finder', {
    p_conversa_id: conversaId,
    p_fingerprint: getChatFingerprint(),
  })
  if (error) throw error
  return data as ChatMensagem
}

export async function enviarPedidoLigacaoTutor(
  conversaId: string,
  telefoneE164?: string | null,
): Promise<ChatMensagem> {
  const corpo = telefoneE164
    ? `Compartilhei meu telefone para ligação: ${telefoneE164}`
    : 'Gostaria de falar por telefone. Pode me enviar um número ou um áudio?'

  const { data, error } = await supabase
    .from('mensagens')
    .insert({
      conversa_id: conversaId,
      autor: 'tutor',
      tipo: 'chamada',
      corpo,
    })
    .select('id, autor, tipo, corpo, midia_path, created_at, lida_em')
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

/** Extrai dígitos E.164 de uma mensagem de chamada com telefone. */
export function extrairTelefoneMensagem(corpo: string): string | null {
  const match = corpo.match(/(\+?\d[\d\s().-]{8,}\d)/)
  if (!match) return null
  const digits = match[1].replace(/\D/g, '')
  if (digits.length < 10) return null
  return digits.startsWith('55') ? digits : `55${digits}`
}

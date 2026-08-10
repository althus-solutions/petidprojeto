export type ChatAutor = 'tutor' | 'finder'

export type ChatMensagemTipo = 'texto' | 'imagem' | 'audio' | 'chamada'

export interface ChatMensagem {
  id: string
  autor: ChatAutor
  tipo?: ChatMensagemTipo
  corpo: string
  midia_path?: string | null
  created_at: string
  lida_em?: string | null
  /** URL assinada resolvida no client */
  midia_url?: string | null
}

export interface ChatConversaResumo {
  id: string
  animal_id: string
  animal_nome: string
  /** Número anônimo do finder na visão do tutor (Finder 1…) */
  finder_rotulo: number | null
  updated_at: string
  nao_lidas: number
  ultima_mensagem: string | null
}

export function tituloConversa(
  conversa: Pick<ChatConversaResumo, 'finder_rotulo' | 'animal_nome'>,
  mode: 'tutor' | 'finder',
): string {
  if (mode === 'tutor') {
    const n = conversa.finder_rotulo ?? 1
    return `Finder ${n}`
  }
  return 'Tutor'
}

export function subtituloConversa(
  conversa: Pick<ChatConversaResumo, 'animal_nome'>,
): string {
  return `Pet encontrado: ${conversa.animal_nome}`
}

export function previewUltimaMensagem(msg: ChatMensagem | string | null): string {
  if (!msg) return 'Sem mensagens'
  if (typeof msg === 'string') return msg
  if (msg.tipo === 'imagem') return '📷 Foto'
  if (msg.tipo === 'audio') return '🎤 Áudio'
  if (msg.tipo === 'chamada') return '📞 Ligação'
  return msg.corpo
}

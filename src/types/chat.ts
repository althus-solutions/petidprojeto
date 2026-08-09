export type ChatAutor = 'tutor' | 'finder'

export interface ChatMensagem {
  id: string
  autor: ChatAutor
  corpo: string
  created_at: string
  lida_em?: string | null
}

export interface ChatConversaResumo {
  id: string
  animal_id: string
  animal_nome: string
  updated_at: string
  nao_lidas: number
  ultima_mensagem: string | null
}

export type CanalNotificacao = 'whatsapp' | 'email' | 'push'

export interface TutorContato {
  id?: string
  telefone: string
  rotulo: string | null
  principal: boolean
}

export interface TutorPerfilForm {
  nome: string
  canal_notificacao_preferido: CanalNotificacao
  contatos: TutorContato[]
}

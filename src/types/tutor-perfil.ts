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
  /** Nova foto selecionada no formulário (upload no save). */
  fotoFile?: File | null
  /** Path atual no Storage, se já existir. */
  foto_url?: string | null
}

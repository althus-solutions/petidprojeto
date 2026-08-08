export type MatchStatus = 'sugerido' | 'confirmado_tutor' | 'descartado'

export type MatchTutor = {
  id: string
  ocorrencia_id: string
  registro_resgate_id: string
  score: number
  status: MatchStatus
  score_versao: string
  detalhes: Record<string, unknown>
  created_at: string
  notificado_em: string | null
  animal_nome: string
  animal_id: string
  porte_estimado: string | null
  cor_estimada: string | null
  raca_estimada: string | null
  especie_estimada: string | null
  regiao_aproximada: string | null
  resgate_foto_path: string | null
  resgate_descricao: string | null
}

export type CandidatoRetencao = {
  id: string
  status: string
  created_at: string
  tem_foto: boolean
  tem_localizacao: boolean
  tem_embedding: boolean
  organizacao_id: string | null
  registrado_por_user_id: string | null
}

export type ResultadoRetencao = {
  ok: boolean
  modo: 'dry_run' | 'aplicar'
  execucao_id: string
  dias_retencao: number
  candidatos: number
  anonimizados: number
  amostra_ids: string[]
  agendamento_ativo: boolean
}

export type SimulacaoRetencao = ResultadoRetencao & {
  candidatos_detalhe: CandidatoRetencao[]
}

export type HistoricoRetencao = {
  id: string
  modo: 'dry_run' | 'aplicar'
  disparado_por: string
  dias_retencao: number
  candidatos: number
  anonimizados: number
  created_at: string
}

export type StatusRetencao = {
  dias_retencao: number | null
  candidatos_atuais: number
  job_retencao: {
    agendamento_ativo?: boolean
    horario_cron_utc?: string
    ultimo_dry_run_em?: string | null
    ultimo_dry_run_candidatos?: number
    ultimo_execucao_em?: string | null
    ultimo_execucao_anonimizados?: number
    atualizado_em?: string
  }
  historico: HistoricoRetencao[]
  cron: Array<{
    jobid?: number
    jobname?: string
    schedule?: string
    command?: string
    active?: boolean
    erro?: string
  }>
}

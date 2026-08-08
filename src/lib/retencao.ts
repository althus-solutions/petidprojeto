import { supabase } from '@/lib/supabase'
import type {
  ResultadoRetencao,
  SimulacaoRetencao,
  StatusRetencao,
} from '@/types/retencao'

export async function obterStatusRetencao(): Promise<StatusRetencao> {
  const { data, error } = await supabase.rpc('obter_status_retencao_admin')
  if (error) throw error
  return data as StatusRetencao
}

export async function simularRetencao(
  limiteAmostra = 25,
): Promise<SimulacaoRetencao> {
  const { data, error } = await supabase.rpc('simular_retencao_admin', {
    p_limite_amostra: limiteAmostra,
  })
  if (error) throw error
  return data as SimulacaoRetencao
}

export async function aplicarRetencao(): Promise<ResultadoRetencao> {
  const { data, error } = await supabase.rpc('aplicar_retencao_admin', {
    p_confirmacao: 'APLICAR_RETENCAO',
  })
  if (error) throw error
  return data as ResultadoRetencao
}

export async function definirAgendamentoRetencao(
  ativo: boolean,
): Promise<{ ok: boolean; job_retencao: StatusRetencao['job_retencao'] }> {
  const { data, error } = await supabase.rpc(
    'definir_agendamento_retencao_admin',
    { p_ativo: ativo },
  )
  if (error) throw error
  return data as { ok: boolean; job_retencao: StatusRetencao['job_retencao'] }
}

import { supabase } from '@/lib/supabase'
import type { OrganizacaoAdminResumo, PainelOrganizacao } from '@/types/orgao'

export async function fetchPainelOrganizacao(
  organizacaoId: string,
  dias = 30,
): Promise<PainelOrganizacao> {
  const { data, error } = await supabase.rpc('obter_painel_organizacao', {
    p_organizacao_id: organizacaoId,
    p_dias: dias,
    p_limite_alertas: 25,
  })

  if (error) throw error
  return data as PainelOrganizacao
}

export async function listarOrganizacoesAdmin(
  status?: 'pendente' | 'aprovado' | 'rejeitado',
): Promise<OrganizacaoAdminResumo[]> {
  const { data, error } = await supabase.rpc('listar_organizacoes_admin', {
    p_status: status ?? null,
  })

  if (error) throw error
  return (data ?? []) as OrganizacaoAdminResumo[]
}

export async function atualizarStatusOrganizacao(
  organizacaoId: string,
  status: 'pendente' | 'aprovado' | 'rejeitado',
): Promise<void> {
  const { error } = await supabase.rpc('atualizar_status_organizacao', {
    p_organizacao_id: organizacaoId,
    p_status: status,
  })

  if (error) throw error
}

export async function definirRegiaoOrganizacao(params: {
  organizacaoId: string
  latitude: number
  longitude: number
  raioKm?: number
}): Promise<void> {
  const { error } = await supabase.rpc('admin_definir_regiao_organizacao', {
    p_organizacao_id: params.organizacaoId,
    p_latitude: params.latitude,
    p_longitude: params.longitude,
    p_raio_km: params.raioKm ?? 10,
  })

  if (error) throw error
}

export function labelTipoOrganizacao(tipo: string): string {
  const map: Record<string, string> = {
    prefeitura: 'Prefeitura',
    pm: 'Polícia / Guarda',
    bombeiros: 'Bombeiros',
    ccz: 'CCZ',
    ong: 'ONG',
    veterinaria: 'Veterinária',
  }
  return map[tipo] ?? tipo
}

export function labelStatusOrganizacao(status: string): string {
  const map: Record<string, string> = {
    pendente: 'Pendente',
    aprovado: 'Aprovada',
    rejeitado: 'Rejeitada',
    aberta: 'Aberta',
    disponivel: 'Disponível',
    em_analise: 'Em análise',
    reencontrado: 'Reencontrado',
    expirada: 'Expirada',
    anonimizado: 'Anonimizado',
  }
  return map[status] ?? status
}

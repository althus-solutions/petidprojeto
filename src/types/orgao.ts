export type AlertaOrganizacaoTipo = 'perdido' | 'resgate'

export interface AlertaOrganizacao {
  id: string
  tipo: AlertaOrganizacaoTipo
  created_at: string
  status: string
  endereco_aproximado: string | null
  regiao_aproximada: string | null
  titulo: string
  especie: string | null
  porte: string | null
  cor: string | null
  porte_estimado: string | null
  descricao_resumo: string | null
}

export interface IndicadoresOrganizacao {
  periodo_dias: number
  perdidos_abertos: number
  perdidos_periodo: number
  resgates_disponiveis: number
  resgates_periodo: number
  resgates_da_organizacao: number
}

export interface PainelOrganizacao {
  organizacao: {
    id: string
    nome: string
    tipo: string
    tem_regiao_configurada: boolean
  }
  indicadores: IndicadoresOrganizacao
  alertas: AlertaOrganizacao[]
  aviso?: string
}

export interface OrganizacaoAdminResumo {
  id: string
  nome: string
  tipo: string
  status_aprovacao: 'pendente' | 'aprovado' | 'rejeitado'
  tem_regiao_configurada: boolean
  created_at: string
}

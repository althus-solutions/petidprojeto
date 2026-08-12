export type AdocaoEspecie = 'cao' | 'gato' | 'outro'
export type AdocaoSexo = 'macho' | 'femea' | 'nao_sei'
export type AdocaoIdadeFaixa = 'filhote' | 'jovem' | 'adulto' | 'idoso'
export type AdocaoPorte = 'pequeno' | 'medio' | 'grande' | 'gigante'
export type AdocaoCastrado = 'sim' | 'nao' | 'nao_sei'
export type AdocaoVacinado = 'sim' | 'nao' | 'parcialmente'
export type AdocaoVermifugado = 'sim' | 'nao'
export type AdocaoMobilidade = 'normal' | 'reduzida' | 'cadeirante'
export type AdocaoEnergia = 'baixo' | 'medio' | 'alto'
export type AdocaoSociavel = 'sim' | 'nao' | 'com_cautela'
export type AdocaoSociabilidadeEstranhos = 'baixa' | 'media' | 'alta'
export type AdocaoOrigem =
  | 'rua'
  | 'abandono'
  | 'ninhada'
  | 'devolucao'
  | 'transferencia'
  | 'outro'
export type AdocaoMoradia = 'apartamento' | 'casa_quintal' | 'indiferente'
export type AdocaoStatus = 'disponivel' | 'em_processo' | 'adotado'
export type AdocaoResponsavelTipo = 'tutor' | 'protetor' | 'ong'
export type AdocaoMidiaTipo = 'foto' | 'video'

export interface AdocaoMidia {
  id: string
  listagem_id: string
  storage_path: string
  tipo: AdocaoMidiaTipo
  ordem: number
}

export interface ListagemAdocao {
  id: string
  tutor_id: string
  animal_id: string | null
  nome: string
  especie: AdocaoEspecie
  raca: string | null
  sexo: AdocaoSexo | null
  idade_faixa: AdocaoIdadeFaixa | null
  data_nascimento_aprox: string | null
  porte: AdocaoPorte | null
  peso_kg: number | null
  cores: string[] | null
  padrao_pelagem: string | null
  castrado: AdocaoCastrado | null
  vacinado: AdocaoVacinado | null
  vacinas_detalhe: string | null
  vermifugado: AdocaoVermifugado | null
  vermifugo_ultima_dose: string | null
  microchipado: boolean | null
  microchip: string | null
  deficiencias: string[] | null
  condicao_cronica: string | null
  historico_doencas: string | null
  medicacao_continua: boolean | null
  medicacao_detalhe: string | null
  restricoes_alimentares: string | null
  mobilidade: AdocaoMobilidade | null
  energia: AdocaoEnergia | null
  sociavel_caes: AdocaoSociavel | null
  sociavel_gatos: AdocaoSociavel | null
  sociavel_criancas: AdocaoSociavel | null
  criancas_idade_minima: number | null
  convive_sozinho: boolean | null
  adestramento_basico: boolean | null
  comportamentos_atencao: string | null
  sociabilidade_estranhos: AdocaoSociabilidadeEstranhos | null
  origem: AdocaoOrigem | null
  tempo_sob_cuidado: string | null
  viveu_em_lar: boolean | null
  motivo_retorno: string | null
  observacoes_protetor: string | null
  moradia_recomendada: AdocaoMoradia | null
  precisa_companheiro: boolean | null
  aceita_criancas: boolean | null
  aceita_criancas_idade_min: number | null
  exige_tela_janelas: boolean | null
  cidade_preferencial: string | null
  regiao_preferencial: string | null
  estado_preferencial: string | null
  acompanhamento_pos: boolean | null
  acompanhamento_detalhe: string | null
  responsavel_nome: string | null
  responsavel_contato: string | null
  responsavel_tipo: AdocaoResponsavelTipo | null
  status: AdocaoStatus
  taxa_adocao_valor: number | null
  taxa_adocao_aplica: boolean
  termo_adocao_aceito_em: string | null
  termo_adocao_contexto: Record<string, unknown> | null
  consentimento_lgpd_em: string | null
  consentimento_lgpd_contexto: Record<string, unknown> | null
  taxa_aceite_em: string | null
  created_at: string
  updated_at: string
}

export interface ListagemAdocaoCard extends ListagemAdocao {
  foto_url?: string | null
  midia?: AdocaoMidia[]
}

export interface AdocaoFilters {
  especie?: AdocaoEspecie | ''
  sexo?: AdocaoSexo | ''
  porte?: AdocaoPorte | ''
  idade_faixa?: AdocaoIdadeFaixa | ''
  castrado?: AdocaoCastrado | ''
  cidade?: string
  sociavel_criancas?: AdocaoSociavel | ''
  status?: AdocaoStatus | ''
  q?: string
}

export interface AdocaoFormValues {
  modoOrigem: 'pet_existente' | 'novo'
  animal_id: string | null
  nome: string
  especie: AdocaoEspecie
  raca: string
  sexo: AdocaoSexo
  idade_faixa: AdocaoIdadeFaixa
  porte: AdocaoPorte
  peso_kg: string
  cores: string[]
  cor_outro: string
  padrao_pelagem: string
  castrado: AdocaoCastrado
  vacinado: AdocaoVacinado
  vacinas_detalhe: string
  vermifugado: AdocaoVermifugado
  vermifugo_ultima_dose: string
  microchipado: boolean
  microchip: string
  deficiencias: string[]
  condicao_cronica: string
  historico_doencas: string
  medicacao_continua: boolean
  medicacao_detalhe: string
  restricoes_alimentares: string
  mobilidade: AdocaoMobilidade
  energia: AdocaoEnergia
  sociavel_caes: AdocaoSociavel
  sociavel_gatos: AdocaoSociavel
  sociavel_criancas: AdocaoSociavel
  criancas_idade_minima: string
  convive_sozinho: boolean | null
  adestramento_basico: boolean | null
  comportamentos_atencao: string
  sociabilidade_estranhos: AdocaoSociabilidadeEstranhos
  origem: AdocaoOrigem
  tempo_sob_cuidado: string
  viveu_em_lar: boolean | null
  motivo_retorno: string
  observacoes_protetor: string
  moradia_recomendada: AdocaoMoradia
  precisa_companheiro: boolean | null
  aceita_criancas: boolean | null
  aceita_criancas_idade_min: string
  exige_tela_janelas: boolean | null
  cidade_preferencial: string
  regiao_preferencial: string
  estado_preferencial: string
  acompanhamento_pos: boolean
  acompanhamento_detalhe: string
  responsavel_nome: string
  responsavel_contato: string
  responsavel_tipo: AdocaoResponsavelTipo
  status: AdocaoStatus
  taxa_adocao_aplica: boolean
  taxa_adocao_valor: string
  fotos: File[]
  /** Paths já existentes (pet referenciado ou edição). */
  fotoPathsExistentes: string[]
  video: File | null
  aceite_termo: boolean
  aceite_lgpd: boolean
  aceite_taxa: boolean
}

export const ADOCAO_DEFICIENCIAS = [
  'Visual',
  'Auditiva',
  'Motora',
  'Outra',
] as const

export const ADOCAO_PADRAO_PELAGEM = [
  'Liso',
  'Sólido',
  'Manchado',
  'Tigrado',
  'Rajado',
  'Enrolado',
  'Sem pelo',
  'Outro',
] as const

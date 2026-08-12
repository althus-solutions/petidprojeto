import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AdocaoForm } from '@/components/adocao/AdocaoForm'
import { useAuth } from '@/contexts/AuthContext'
import { emptyAdocaoForm, getListagemAdocao } from '@/lib/adocao'
import type { AdocaoFormValues } from '@/types/adocao'

export function TutorAdocaoEditPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [initial, setInitial] = useState<Partial<AdocaoFormValues> | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id || !user?.tutor?.id) return
    void getListagemAdocao(id)
      .then((l) => {
        if (!l) {
          setError('Anúncio não encontrado')
          return
        }
        if (l.tutor_id !== user.tutor!.id) {
          setError('Sem permissão para editar')
          return
        }
        setInitial({
          ...emptyAdocaoForm(),
          modoOrigem: l.animal_id ? 'pet_existente' : 'novo',
          animal_id: l.animal_id,
          nome: l.nome,
          especie: l.especie,
          raca: l.raca ?? 'SRD',
          sexo: l.sexo ?? 'nao_sei',
          idade_faixa: l.idade_faixa ?? 'adulto',
          porte: l.porte ?? 'medio',
          peso_kg: l.peso_kg != null ? String(l.peso_kg) : '',
          cores: l.cores ?? [],
          padrao_pelagem: l.padrao_pelagem ?? 'Sólido',
          castrado: l.castrado ?? 'nao_sei',
          vacinado: l.vacinado ?? 'nao',
          vacinas_detalhe: l.vacinas_detalhe ?? '',
          vermifugado: l.vermifugado ?? 'nao',
          vermifugo_ultima_dose: l.vermifugo_ultima_dose ?? '',
          microchipado: Boolean(l.microchipado),
          microchip: l.microchip ?? '',
          deficiencias: l.deficiencias ?? [],
          condicao_cronica: l.condicao_cronica ?? '',
          historico_doencas: l.historico_doencas ?? '',
          medicacao_continua: Boolean(l.medicacao_continua),
          medicacao_detalhe: l.medicacao_detalhe ?? '',
          restricoes_alimentares: l.restricoes_alimentares ?? '',
          mobilidade: l.mobilidade ?? 'normal',
          energia: l.energia ?? 'medio',
          sociavel_caes: l.sociavel_caes ?? 'com_cautela',
          sociavel_gatos: l.sociavel_gatos ?? 'com_cautela',
          sociavel_criancas: l.sociavel_criancas ?? 'com_cautela',
          criancas_idade_minima:
            l.criancas_idade_minima != null
              ? String(l.criancas_idade_minima)
              : '',
          convive_sozinho: l.convive_sozinho,
          adestramento_basico: l.adestramento_basico,
          comportamentos_atencao: l.comportamentos_atencao ?? '',
          sociabilidade_estranhos: l.sociabilidade_estranhos ?? 'media',
          origem: l.origem ?? 'outro',
          tempo_sob_cuidado: l.tempo_sob_cuidado ?? '',
          viveu_em_lar: l.viveu_em_lar,
          motivo_retorno: l.motivo_retorno ?? '',
          observacoes_protetor: l.observacoes_protetor ?? '',
          moradia_recomendada: l.moradia_recomendada ?? 'indiferente',
          precisa_companheiro: l.precisa_companheiro,
          aceita_criancas: l.aceita_criancas,
          aceita_criancas_idade_min:
            l.aceita_criancas_idade_min != null
              ? String(l.aceita_criancas_idade_min)
              : '',
          exige_tela_janelas: l.exige_tela_janelas,
          cidade_preferencial: l.cidade_preferencial ?? '',
          regiao_preferencial: l.regiao_preferencial ?? '',
          estado_preferencial: l.estado_preferencial ?? '',
          acompanhamento_pos: Boolean(l.acompanhamento_pos),
          acompanhamento_detalhe: l.acompanhamento_detalhe ?? '',
          responsavel_nome: l.responsavel_nome ?? '',
          responsavel_contato: l.responsavel_contato ?? '',
          responsavel_tipo: l.responsavel_tipo ?? 'tutor',
          status: l.status,
          taxa_adocao_aplica: l.taxa_adocao_aplica,
          taxa_adocao_valor:
            l.taxa_adocao_valor != null ? String(l.taxa_adocao_valor) : '',
          fotoPathsExistentes:
            l.midia?.filter((m) => m.tipo === 'foto').map((m) => m.storage_path) ??
            [],
          aceite_termo: true,
          aceite_lgpd: true,
          aceite_taxa: !l.taxa_adocao_aplica || Boolean(l.taxa_aceite_em),
        })
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Erro ao carregar'),
      )
  }, [id, user?.tutor?.id])

  if (error) {
    return (
      <div>
        <p className="text-sm text-red-600">{error}</p>
        <Link
          to="/tutor/adocao"
          className="mt-3 inline-block font-bold text-brand-500"
        >
          ← Galeria
        </Link>
      </div>
    )
  }

  if (!initial || !id) {
    return <p className="text-sm text-gray-500">Carregando…</p>
  }

  return (
    <div>
      <div className="mb-3">
        <Link
          to={`/tutor/adocao/${id}`}
          className="text-[13px] font-bold text-brand-500 hover:underline"
        >
          ← Voltar ao anúncio
        </Link>
      </div>
      <AdocaoForm
        listagemId={id}
        initial={initial}
        onSuccess={(listagem) => {
          navigate(`/tutor/adocao/${listagem.id}`, { replace: true })
        }}
      />
    </div>
  )
}

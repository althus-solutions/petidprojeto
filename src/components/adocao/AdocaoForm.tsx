import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { TelecaoPartnershipBadge } from '@/components/adocao/TelecaoPartnershipBadge'
import { useAuth } from '@/contexts/AuthContext'
import {
  createListagemAdocao,
  emptyAdocaoForm,
  prefillFromAnimal,
  updateListagemAdocao,
} from '@/lib/adocao'
import { listAnimaisByTutor } from '@/lib/pets'
import { CORES_PADRAO } from '@/types/pet'
import {
  ADOCAO_DEFICIENCIAS,
  ADOCAO_PADRAO_PELAGEM,
  type AdocaoFormValues,
  type ListagemAdocao,
} from '@/types/adocao'
import type { Animal } from '@/types/pet'

const field =
  'w-full rounded-[10px] border-[1.5px] border-[#E5E5E5] bg-white px-3.5 py-2.5 text-[13.5px] text-telecao-dark outline-none focus:border-telecao-500'
const labelCls = 'mb-1 block text-[13px] font-bold text-telecao-dark'

interface AdocaoFormProps {
  initial?: Partial<AdocaoFormValues>
  listagemId?: string
  onSuccess: (listagem: ListagemAdocao) => void
}

export function AdocaoForm({ initial, listagemId, onSuccess }: AdocaoFormProps) {
  const { user } = useAuth()
  const [values, setValues] = useState<AdocaoFormValues>(() =>
    emptyAdocaoForm({
      responsavel_nome: user?.tutor?.nome ?? '',
      responsavel_contato: user?.tutor?.telefone ?? '',
      ...initial,
    }),
  )
  const [pets, setPets] = useState<Animal[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previews, setPreviews] = useState<string[]>([])

  useEffect(() => {
    if (!user?.tutor?.id) return
    void listAnimaisByTutor(user.tutor.id).then(setPets).catch(() => setPets([]))
  }, [user?.tutor?.id])

  useEffect(() => {
    const urls = values.fotos.map((f) => URL.createObjectURL(f))
    setPreviews(urls)
    return () => urls.forEach((u) => URL.revokeObjectURL(u))
  }, [values.fotos])

  function set<K extends keyof AdocaoFormValues>(key: K, v: AdocaoFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: v }))
  }

  function toggleCor(cor: string) {
    setValues((prev) => {
      const has = prev.cores.includes(cor)
      return {
        ...prev,
        cores: has ? prev.cores.filter((c) => c !== cor) : [...prev.cores, cor],
      }
    })
  }

  function toggleDeficiencia(d: string) {
    setValues((prev) => {
      const has = prev.deficiencias.includes(d)
      return {
        ...prev,
        deficiencias: has
          ? prev.deficiencias.filter((x) => x !== d)
          : [...prev.deficiencias, d],
      }
    })
  }

  async function handleSelectPet(animalId: string) {
    if (!animalId) {
      set('animal_id', null)
      return
    }
    try {
      const partial = await prefillFromAnimal(animalId)
      setValues((prev) => ({ ...prev, ...partial }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar pet')
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!user?.tutor?.id) {
      setError('Sessão inválida')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const listagem = listagemId
        ? await updateListagemAdocao(listagemId, user.tutor.id, values)
        : await createListagemAdocao(user.tutor.id, values)
      onSuccess(listagem)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="mx-auto max-w-2xl space-y-3">
      <TelecaoPartnershipBadge />
      <div className="rounded-[14px] border border-[#E5E5E5] border-t-[6px] border-t-telecao-500 bg-white px-5 py-6 shadow-sm sm:px-8 sm:py-8">
        <h1 className="font-display text-[26px] font-extrabold text-telecao-dark">
          {listagemId ? 'Editar anúncio' : 'Cadastro para adoção'}
        </h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-gray-500">
          Preencha os dados para que interessados encontrem o animal. As
          informações são tratadas com confidencialidade.
        </p>

        <Section title="Origem do animal">
          <div className="flex flex-col gap-2 sm:flex-row">
            <OriginBtn
              active={values.modoOrigem === 'pet_existente'}
              onClick={() => set('modoOrigem', 'pet_existente')}
              label="Usar pet já cadastrado"
            />
            <OriginBtn
              active={values.modoOrigem === 'novo'}
              onClick={() => {
                set('modoOrigem', 'novo')
                set('animal_id', null)
                set('fotoPathsExistentes', [])
              }}
              label="Cadastrar outro"
            />
          </div>
          {values.modoOrigem === 'pet_existente' && (
            <label className="mt-3 block">
              <span className={labelCls}>Selecione o pet</span>
              <select
                className={field}
                value={values.animal_id ?? ''}
                onChange={(e) => void handleSelectPet(e.target.value)}
                required
              >
                <option value="">Escolha…</option>
                {pets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
              {values.fotoPathsExistentes.length > 0 && (
                <p className="mt-1.5 text-[12px] text-telecao-600">
                  {values.fotoPathsExistentes.length} foto(s) do perfil serão
                  reutilizadas.
                </p>
              )}
            </label>
          )}
        </Section>

        <Section title="1. Identificação do animal">
          <Grid>
            <Field label="Nome (ou apelido temporário)">
              <input
                className={field}
                value={values.nome}
                onChange={(e) => set('nome', e.target.value)}
                placeholder="Ex.: Sem nome / Thor"
                required
              />
            </Field>
            <Field label="Espécie">
              <select
                className={field}
                value={values.especie}
                onChange={(e) =>
                  set('especie', e.target.value as AdocaoFormValues['especie'])
                }
              >
                <option value="cao">Cão</option>
                <option value="gato">Gato</option>
                <option value="outro">Outro</option>
              </select>
            </Field>
            <Field label="Raça">
              <input
                className={field}
                value={values.raca}
                onChange={(e) => set('raca', e.target.value)}
                placeholder="SRD"
              />
            </Field>
            <Field label="Sexo">
              <select
                className={field}
                value={values.sexo}
                onChange={(e) =>
                  set('sexo', e.target.value as AdocaoFormValues['sexo'])
                }
              >
                <option value="macho">Macho</option>
                <option value="femea">Fêmea</option>
                <option value="nao_sei">Não sei</option>
              </select>
            </Field>
            <Field label="Idade estimada">
              <select
                className={field}
                value={values.idade_faixa}
                onChange={(e) =>
                  set(
                    'idade_faixa',
                    e.target.value as AdocaoFormValues['idade_faixa'],
                  )
                }
              >
                <option value="filhote">Filhote</option>
                <option value="jovem">Jovem</option>
                <option value="adulto">Adulto</option>
                <option value="idoso">Idoso</option>
              </select>
            </Field>
            <Field label="Porte">
              <select
                className={field}
                value={values.porte}
                onChange={(e) =>
                  set('porte', e.target.value as AdocaoFormValues['porte'])
                }
              >
                <option value="pequeno">Pequeno</option>
                <option value="medio">Médio</option>
                <option value="grande">Grande</option>
                <option value="gigante">Gigante</option>
              </select>
            </Field>
            <Field label="Peso atual (kg)">
              <input
                className={field}
                type="number"
                step="0.1"
                min="0"
                value={values.peso_kg}
                onChange={(e) => set('peso_kg', e.target.value)}
              />
            </Field>
            <Field label="Padrão da pelagem">
              <select
                className={field}
                value={values.padrao_pelagem}
                onChange={(e) => set('padrao_pelagem', e.target.value)}
              >
                {ADOCAO_PADRAO_PELAGEM.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </Field>
          </Grid>

          <div className="mt-3">
            <span className={labelCls}>Cores da pelagem</span>
            <div className="flex flex-wrap gap-2">
              {CORES_PADRAO.map((cor) => {
                const on = values.cores.includes(cor)
                return (
                  <button
                    key={cor}
                    type="button"
                    onClick={() => toggleCor(cor)}
                    className={[
                      'rounded-full px-3 py-1.5 text-[12px] font-bold',
                      on
                        ? 'bg-telecao-500 text-white'
                        : 'bg-telecao-50 text-telecao-700',
                    ].join(' ')}
                  >
                    {cor}
                  </button>
                )
              })}
            </div>
            {values.cores.includes('Outro') && (
              <input
                className={`${field} mt-2`}
                placeholder="Descreva a cor"
                value={values.cor_outro}
                onChange={(e) => set('cor_outro', e.target.value)}
              />
            )}
          </div>

          <Grid className="mt-3">
            <Field label="Castrado?">
              <select
                className={field}
                value={values.castrado}
                onChange={(e) =>
                  set('castrado', e.target.value as AdocaoFormValues['castrado'])
                }
              >
                <option value="sim">Sim</option>
                <option value="nao">Não</option>
                <option value="nao_sei">Não sei</option>
              </select>
            </Field>
            <Field label="Vacinado?">
              <select
                className={field}
                value={values.vacinado}
                onChange={(e) =>
                  set('vacinado', e.target.value as AdocaoFormValues['vacinado'])
                }
              >
                <option value="sim">Sim</option>
                <option value="nao">Não</option>
                <option value="parcialmente">Parcialmente</option>
              </select>
            </Field>
            {(values.vacinado === 'parcialmente' || values.vacinado === 'sim') && (
              <Field label="Quais vacinas?" className="sm:col-span-2">
                <input
                  className={field}
                  value={values.vacinas_detalhe}
                  onChange={(e) => set('vacinas_detalhe', e.target.value)}
                />
              </Field>
            )}
            <Field label="Vermifugado?">
              <select
                className={field}
                value={values.vermifugado}
                onChange={(e) =>
                  set(
                    'vermifugado',
                    e.target.value as AdocaoFormValues['vermifugado'],
                  )
                }
              >
                <option value="sim">Sim</option>
                <option value="nao">Não</option>
              </select>
            </Field>
            {values.vermifugado === 'sim' && (
              <Field label="Última dose">
                <input
                  className={field}
                  type="date"
                  value={values.vermifugo_ultima_dose}
                  onChange={(e) => set('vermifugo_ultima_dose', e.target.value)}
                />
              </Field>
            )}
            <Field label="Microchipado?">
              <select
                className={field}
                value={values.microchipado ? 'sim' : 'nao'}
                onChange={(e) => set('microchipado', e.target.value === 'sim')}
              >
                <option value="sim">Sim</option>
                <option value="nao">Não</option>
              </select>
            </Field>
            {values.microchipado && (
              <Field label="Nº do microchip">
                <input
                  className={field}
                  value={values.microchip}
                  onChange={(e) => set('microchip', e.target.value)}
                />
              </Field>
            )}
          </Grid>
        </Section>

        <Section title="2. Saúde">
          <span className={labelCls}>Deficiências</span>
          <div className="mb-3 flex flex-wrap gap-2">
            {ADOCAO_DEFICIENCIAS.map((d) => {
              const on = values.deficiencias.includes(d)
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleDeficiencia(d)}
                  className={[
                    'rounded-full px-3 py-1.5 text-[12px] font-bold',
                    on
                      ? 'bg-telecao-500 text-white'
                      : 'bg-telecao-50 text-telecao-700',
                  ].join(' ')}
                >
                  {d}
                </button>
              )
            })}
          </div>
          <Grid>
            <Field label="Condição crônica" className="sm:col-span-2">
              <input
                className={field}
                value={values.condicao_cronica}
                onChange={(e) => set('condicao_cronica', e.target.value)}
              />
            </Field>
            <Field label="Histórico de doenças" className="sm:col-span-2">
              <textarea
                className={field}
                rows={2}
                value={values.historico_doencas}
                onChange={(e) => set('historico_doencas', e.target.value)}
              />
            </Field>
            <Field label="Medicação contínua?">
              <select
                className={field}
                value={values.medicacao_continua ? 'sim' : 'nao'}
                onChange={(e) =>
                  set('medicacao_continua', e.target.value === 'sim')
                }
              >
                <option value="nao">Não</option>
                <option value="sim">Sim</option>
              </select>
            </Field>
            {values.medicacao_continua && (
              <Field label="Qual medicação?">
                <input
                  className={field}
                  value={values.medicacao_detalhe}
                  onChange={(e) => set('medicacao_detalhe', e.target.value)}
                />
              </Field>
            )}
            <Field label="Restrições alimentares" className="sm:col-span-2">
              <input
                className={field}
                value={values.restricoes_alimentares}
                onChange={(e) => set('restricoes_alimentares', e.target.value)}
              />
            </Field>
            <Field label="Mobilidade">
              <select
                className={field}
                value={values.mobilidade}
                onChange={(e) =>
                  set(
                    'mobilidade',
                    e.target.value as AdocaoFormValues['mobilidade'],
                  )
                }
              >
                <option value="normal">Normal</option>
                <option value="reduzida">Reduzida</option>
                <option value="cadeirante">Cadeirante</option>
              </select>
            </Field>
          </Grid>
        </Section>

        <Section title="3. Temperamento e comportamento">
          <Grid>
            <Field label="Nível de energia">
              <select
                className={field}
                value={values.energia}
                onChange={(e) =>
                  set('energia', e.target.value as AdocaoFormValues['energia'])
                }
              >
                <option value="baixo">Baixo</option>
                <option value="medio">Médio</option>
                <option value="alto">Alto</option>
              </select>
            </Field>
            <Field label="Sociável com cães?">
              <SociavelSelect
                value={values.sociavel_caes}
                onChange={(v) => set('sociavel_caes', v)}
              />
            </Field>
            <Field label="Sociável com gatos?">
              <SociavelSelect
                value={values.sociavel_gatos}
                onChange={(v) => set('sociavel_gatos', v)}
              />
            </Field>
            <Field label="Sociável com crianças?">
              <SociavelSelect
                value={values.sociavel_criancas}
                onChange={(v) => set('sociavel_criancas', v)}
              />
            </Field>
            {(values.sociavel_criancas === 'sim' ||
              values.sociavel_criancas === 'com_cautela') && (
              <Field label="A partir de que idade?">
                <input
                  className={field}
                  type="number"
                  min="0"
                  value={values.criancas_idade_minima}
                  onChange={(e) => set('criancas_idade_minima', e.target.value)}
                />
              </Field>
            )}
            <Field label="Convive bem sozinho?">
              <TriBool
                value={values.convive_sozinho}
                onChange={(v) => set('convive_sozinho', v)}
              />
            </Field>
            <Field label="Adestramento básico?">
              <TriBool
                value={values.adestramento_basico}
                onChange={(v) => set('adestramento_basico', v)}
              />
            </Field>
            <Field label="Sociabilidade com estranhos">
              <select
                className={field}
                value={values.sociabilidade_estranhos}
                onChange={(e) =>
                  set(
                    'sociabilidade_estranhos',
                    e.target.value as AdocaoFormValues['sociabilidade_estranhos'],
                  )
                }
              >
                <option value="baixa">Baixa</option>
                <option value="media">Média</option>
                <option value="alta">Alta</option>
              </select>
            </Field>
            <Field label="Comportamentos de atenção" className="sm:col-span-2">
              <textarea
                className={field}
                rows={2}
                placeholder="Ansiedade de separação, medo de barulho, fuga…"
                value={values.comportamentos_atencao}
                onChange={(e) => set('comportamentos_atencao', e.target.value)}
              />
            </Field>
          </Grid>
        </Section>

        <Section title="4. Histórico do animal">
          <Grid>
            <Field label="Origem">
              <select
                className={field}
                value={values.origem}
                onChange={(e) =>
                  set('origem', e.target.value as AdocaoFormValues['origem'])
                }
              >
                <option value="rua">Resgate de rua</option>
                <option value="abandono">Abandono</option>
                <option value="ninhada">Ninhada</option>
                <option value="devolucao">Devolução</option>
                <option value="transferencia">Transferência</option>
                <option value="outro">Outro</option>
              </select>
            </Field>
            <Field label="Tempo sob cuidado">
              <input
                className={field}
                value={values.tempo_sob_cuidado}
                onChange={(e) => set('tempo_sob_cuidado', e.target.value)}
                placeholder="Ex.: 3 meses"
              />
            </Field>
            <Field label="Já viveu em lar?">
              <TriBool
                value={values.viveu_em_lar}
                onChange={(v) => set('viveu_em_lar', v)}
              />
            </Field>
            {values.viveu_em_lar && (
              <Field label="Motivo do retorno" className="sm:col-span-2">
                <input
                  className={field}
                  value={values.motivo_retorno}
                  onChange={(e) => set('motivo_retorno', e.target.value)}
                />
              </Field>
            )}
            <Field label="Observações do protetor" className="sm:col-span-2">
              <textarea
                className={field}
                rows={3}
                value={values.observacoes_protetor}
                onChange={(e) => set('observacoes_protetor', e.target.value)}
              />
            </Field>
          </Grid>
        </Section>

        <Section title="5. Requisitos para adoção">
          <Grid>
            <Field label="Moradia recomendada">
              <select
                className={field}
                value={values.moradia_recomendada}
                onChange={(e) =>
                  set(
                    'moradia_recomendada',
                    e.target.value as AdocaoFormValues['moradia_recomendada'],
                  )
                }
              >
                <option value="apartamento">Apartamento</option>
                <option value="casa_quintal">Casa com quintal</option>
                <option value="indiferente">Indiferente</option>
              </select>
            </Field>
            <Field label="Precisa de companheiro animal?">
              <TriBool
                value={values.precisa_companheiro}
                onChange={(v) => set('precisa_companheiro', v)}
              />
            </Field>
            <Field label="Aceita lares com crianças?">
              <TriBool
                value={values.aceita_criancas}
                onChange={(v) => set('aceita_criancas', v)}
              />
            </Field>
            {values.aceita_criancas && (
              <Field label="Crianças a partir de (anos)">
                <input
                  className={field}
                  type="number"
                  min="0"
                  value={values.aceita_criancas_idade_min}
                  onChange={(e) =>
                    set('aceita_criancas_idade_min', e.target.value)
                  }
                />
              </Field>
            )}
            <Field label="Exige tela nas janelas?">
              <TriBool
                value={values.exige_tela_janelas}
                onChange={(v) => set('exige_tela_janelas', v)}
              />
            </Field>
            <Field label="UF">
              <input
                className={field}
                maxLength={2}
                value={values.estado_preferencial}
                onChange={(e) =>
                  set('estado_preferencial', e.target.value.toUpperCase())
                }
                placeholder="SP"
              />
            </Field>
            <Field label="Cidade preferencial">
              <input
                className={field}
                value={values.cidade_preferencial}
                onChange={(e) => set('cidade_preferencial', e.target.value)}
              />
            </Field>
            <Field label="Região / bairro">
              <input
                className={field}
                value={values.regiao_preferencial}
                onChange={(e) => set('regiao_preferencial', e.target.value)}
              />
            </Field>
            <Field label="Acompanhamento pós-adoção?">
              <select
                className={field}
                value={values.acompanhamento_pos ? 'sim' : 'nao'}
                onChange={(e) =>
                  set('acompanhamento_pos', e.target.value === 'sim')
                }
              >
                <option value="nao">Não</option>
                <option value="sim">Sim</option>
              </select>
            </Field>
            {values.acompanhamento_pos && (
              <Field label="Detalhe do acompanhamento" className="sm:col-span-2">
                <input
                  className={field}
                  value={values.acompanhamento_detalhe}
                  onChange={(e) => set('acompanhamento_detalhe', e.target.value)}
                  placeholder="Visita em X dias, checkup…"
                />
              </Field>
            )}
          </Grid>
        </Section>

        <Section title="6. Mídia">
          <Field label="Fotos (múltiplas)">
            <input
              type="file"
              accept="image/jpeg,image/png,image/jpg"
              multiple
              className="block w-full text-[13px]"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? [])
                set('fotos', files.slice(0, 6))
              }}
            />
          </Field>
          {(previews.length > 0 || values.fotoPathsExistentes.length > 0) && (
            <p className="mt-2 text-[12px] text-telecao-muted">
              {values.fotoPathsExistentes.length > 0 &&
                `${values.fotoPathsExistentes.length} do perfil · `}
              {previews.length} nova(s) selecionada(s)
            </p>
          )}
          {previews.length > 0 && (
            <div className="mt-2 grid grid-cols-3 gap-2">
              {previews.map((src) => (
                <img
                  key={src}
                  src={src}
                  alt=""
                  className="aspect-square rounded-[10px] object-cover"
                />
              ))}
            </div>
          )}
          <Field label="Vídeo curto (opcional)" className="mt-3">
            <input
              type="file"
              accept="video/mp4,video/webm,video/quicktime"
              className="block w-full text-[13px]"
              onChange={(e) => set('video', e.target.files?.[0] ?? null)}
            />
          </Field>
        </Section>

        <Section title="7. Responsável pelo cadastro">
          <Grid>
            <Field label="Nome do responsável">
              <input
                className={field}
                value={values.responsavel_nome}
                onChange={(e) => set('responsavel_nome', e.target.value)}
                required
              />
            </Field>
            <Field label="Contato (WhatsApp / telefone)">
              <input
                className={field}
                value={values.responsavel_contato}
                onChange={(e) => set('responsavel_contato', e.target.value)}
                required
              />
            </Field>
            <Field label="Tipo">
              <select
                className={field}
                value={values.responsavel_tipo}
                onChange={(e) =>
                  set(
                    'responsavel_tipo',
                    e.target.value as AdocaoFormValues['responsavel_tipo'],
                  )
                }
              >
                <option value="tutor">Tutor / protetor independente</option>
                <option value="protetor">Protetor</option>
                <option value="ong">ONG</option>
              </select>
            </Field>
            <Field label="Status atual">
              <select
                className={field}
                value={values.status}
                onChange={(e) =>
                  set('status', e.target.value as AdocaoFormValues['status'])
                }
              >
                <option value="disponivel">Disponível</option>
                <option value="em_processo">Em processo de adoção</option>
                <option value="adotado">Adotado</option>
              </select>
            </Field>
            <Field label="Há taxa de adoção?">
              <select
                className={field}
                value={values.taxa_adocao_aplica ? 'sim' : 'nao'}
                onChange={(e) =>
                  set('taxa_adocao_aplica', e.target.value === 'sim')
                }
              >
                <option value="nao">Não</option>
                <option value="sim">Sim</option>
              </select>
            </Field>
            {values.taxa_adocao_aplica && (
              <Field label="Valor da taxa (R$)">
                <input
                  className={field}
                  type="number"
                  min="0"
                  step="0.01"
                  value={values.taxa_adocao_valor}
                  onChange={(e) => set('taxa_adocao_valor', e.target.value)}
                />
              </Field>
            )}
          </Grid>
        </Section>

        <Section title="8. Consentimento e termos">
          <label className="flex cursor-pointer items-start gap-2.5 rounded-[12px] bg-telecao-50 px-3.5 py-3">
            <input
              type="checkbox"
              className="mt-0.5 accent-telecao-500"
              checked={values.aceite_termo}
              onChange={(e) => set('aceite_termo', e.target.checked)}
            />
            <span className="text-[13px] leading-relaxed text-telecao-dark">
              Aceito o termo de responsabilidade da adoção responsável (TeleCão /
              MyPetID). *
            </span>
          </label>
          <label className="mt-2 flex cursor-pointer items-start gap-2.5 rounded-[12px] bg-telecao-50 px-3.5 py-3">
            <input
              type="checkbox"
              className="mt-0.5 accent-telecao-500"
              checked={values.aceite_lgpd}
              onChange={(e) => set('aceite_lgpd', e.target.checked)}
            />
            <span className="text-[13px] leading-relaxed text-telecao-dark">
              Autorizo o tratamento dos dados deste anúncio conforme a LGPD, para
              fins de adoção. *
            </span>
          </label>
          {values.taxa_adocao_aplica && (
            <label className="mt-2 flex cursor-pointer items-start gap-2.5 rounded-[12px] bg-telecao-50 px-3.5 py-3">
              <input
                type="checkbox"
                className="mt-0.5 accent-telecao-500"
                checked={values.aceite_taxa}
                onChange={(e) => set('aceite_taxa', e.target.checked)}
              />
              <span className="text-[13px] leading-relaxed text-telecao-dark">
                Declaro ciência da taxa de adoção
                {values.taxa_adocao_valor
                  ? ` de R$ ${values.taxa_adocao_valor}`
                  : ''}
                . *
              </span>
            </label>
          )}
        </Section>

        {error && (
          <p className="mt-4 rounded-[12px] bg-red-50 px-3.5 py-3 text-[13px] text-red-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full rounded-[12px] bg-telecao-500 py-3.5 text-[15px] font-extrabold text-white shadow-md transition hover:bg-telecao-600 disabled:opacity-60"
        >
          {loading
            ? 'Publicando…'
            : listagemId
              ? 'Salvar alterações'
              : 'Publicar na galeria'}
        </button>
      </div>
    </form>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="mt-8 border-t border-[#F0F0F0] pt-6">
      <h2 className="mb-4 font-display text-[17px] font-extrabold text-telecao-dark">
        {title}
      </h2>
      {children}
    </section>
  )
}

function Grid({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`grid gap-3 sm:grid-cols-2 ${className}`}>{children}</div>
  )
}

function Field({
  label,
  children,
  className = '',
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <label className={`block ${className}`}>
      <span className={labelCls}>{label}</span>
      {children}
    </label>
  )
}

function OriginBtn({
  active,
  onClick,
  label,
}: {
  active: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'flex-1 rounded-[12px] border-2 px-3 py-3 text-[13px] font-bold transition',
        active
          ? 'border-telecao-500 bg-telecao-50 text-telecao-700'
          : 'border-[#E5E5E5] bg-white text-telecao-muted',
      ].join(' ')}
    >
      {label}
    </button>
  )
}

function SociavelSelect({
  value,
  onChange,
}: {
  value: AdocaoFormValues['sociavel_caes']
  onChange: (v: AdocaoFormValues['sociavel_caes']) => void
}) {
  return (
    <select
      className={field}
      value={value}
      onChange={(e) =>
        onChange(e.target.value as AdocaoFormValues['sociavel_caes'])
      }
    >
      <option value="sim">Sim</option>
      <option value="nao">Não</option>
      <option value="com_cautela">Com cautela</option>
    </select>
  )
}

function TriBool({
  value,
  onChange,
}: {
  value: boolean | null
  onChange: (v: boolean | null) => void
}) {
  const v = value === true ? 'sim' : value === false ? 'nao' : ''
  return (
    <select
      className={field}
      value={v}
      onChange={(e) => {
        if (e.target.value === 'sim') onChange(true)
        else if (e.target.value === 'nao') onChange(false)
        else onChange(null)
      }}
    >
      <option value="">Não informado</option>
      <option value="sim">Sim</option>
      <option value="nao">Não</option>
    </select>
  )
}

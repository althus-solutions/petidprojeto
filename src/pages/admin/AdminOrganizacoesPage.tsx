import { Fragment, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { AdminBreadcrumb } from '@/components/admin/AdminBreadcrumb'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import {
  atualizarStatusOrganizacao,
  definirRegiaoOrganizacao,
  labelTipoOrganizacao,
  listarOrganizacoesAdmin,
} from '@/lib/orgao'
import type { OrganizacaoAdminResumo } from '@/types/orgao'

type FiltroStatus = 'pendente' | 'aprovado' | 'rejeitado' | ''

const FILTROS: { value: FiltroStatus; label: string }[] = [
  { value: '', label: 'Todas' },
  { value: 'pendente', label: 'Pendentes' },
  { value: 'aprovado', label: 'Aprovadas' },
  { value: 'rejeitado', label: 'Rejeitadas' },
]

function statusBadgeVariant(
  status: OrganizacaoAdminResumo['status_aprovacao'],
): 'warning' | 'success' | 'danger' {
  if (status === 'aprovado') return 'success'
  if (status === 'rejeitado') return 'danger'
  return 'warning'
}

function statusLabel(status: OrganizacaoAdminResumo['status_aprovacao']): string {
  if (status === 'aprovado') return 'Aprovado'
  if (status === 'rejeitado') return 'Rejeitado'
  return 'Pendente'
}

function ActionButton({
  children,
  className,
  disabled,
  onClick,
}: {
  children: ReactNode
  className: string
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        'rounded-full px-3.5 py-[7px] text-[12.5px] font-bold transition-opacity disabled:cursor-not-allowed disabled:opacity-50',
        className,
      ].join(' ')}
    >
      {children}
    </button>
  )
}

export function AdminOrganizacoesPage() {
  const [filtro, setFiltro] = useState<FiltroStatus>('')
  const [todas, setTodas] = useState<OrganizacaoAdminResumo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [regiaoForm, setRegiaoForm] = useState<Record<string, string>>({})
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [expandedRegiaoId, setExpandedRegiaoId] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listarOrganizacoesAdmin()
      setTodas(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao listar organizações')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const contadores = useMemo(
    () => ({
      todas: todas.length,
      pendente: todas.filter((o) => o.status_aprovacao === 'pendente').length,
      aprovado: todas.filter((o) => o.status_aprovacao === 'aprovado').length,
      rejeitado: todas.filter((o) => o.status_aprovacao === 'rejeitado').length,
    }),
    [todas],
  )

  const lista = useMemo(
    () =>
      filtro
        ? todas.filter((org) => org.status_aprovacao === filtro)
        : todas,
    [filtro, todas],
  )

  async function handleStatus(orgId: string, status: 'aprovado' | 'rejeitado') {
    setActionLoading(orgId)
    try {
      await atualizarStatusOrganizacao(orgId, status)
      await carregar()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar status')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleRegiao(orgId: string) {
    const lat = parseFloat(regiaoForm[`${orgId}_lat`] ?? '')
    const lng = parseFloat(regiaoForm[`${orgId}_lng`] ?? '')
    const raio = parseFloat(regiaoForm[`${orgId}_raio`] ?? '10')

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      setError('Informe latitude e longitude válidas para a região.')
      return
    }

    setActionLoading(`regiao-${orgId}`)
    try {
      await definirRegiaoOrganizacao({
        organizacaoId: orgId,
        latitude: lat,
        longitude: lng,
        raioKm: Number.isNaN(raio) ? 10 : raio,
      })
      setExpandedRegiaoId(null)
      await carregar()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao definir região')
    } finally {
      setActionLoading(null)
    }
  }

  function setCampo(orgId: string, campo: string, valor: string) {
    setRegiaoForm((prev) => ({ ...prev, [`${orgId}_${campo}`]: valor }))
  }

  function filtroCount(value: FiltroStatus) {
    if (value === '') return contadores.todas
    return contadores[value]
  }

  return (
    <section>
      <AdminBreadcrumb current="Organizações" />

      <div className="mb-6">
        <h1 className="font-display text-2xl font-extrabold text-brand-dark">
          Organizações
        </h1>
        <p className="mt-1.5 text-sm text-gray-500">
          Aprovar cadastros e definir a região de atuação de cada órgão parceiro.
        </p>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {FILTROS.map((item) => (
          <button
            key={item.value || 'todas'}
            type="button"
            onClick={() => setFiltro(item.value)}
            className={[
              'rounded-full border px-[18px] py-2 text-[13.5px] font-bold transition-colors',
              filtro === item.value
                ? 'border-brand-500 bg-brand-500 text-white'
                : 'border-surface-border bg-white text-gray-500 hover:text-brand-500',
            ].join(' ')}
          >
            {item.label} ({filtroCount(item.value)})
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-gray-500">Carregando…</p>}
      {error && (
        <p className="mb-4 rounded-[14px] bg-brand-50 px-4 py-3 text-sm text-brand-700">
          {error}
        </p>
      )}

      <div className="overflow-hidden rounded-card border border-surface-border bg-white shadow-card">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="border-b border-surface-border">
                <th className="px-[22px] py-4 text-left text-xs font-bold uppercase tracking-wide text-gray-300">
                  Organização
                </th>
                <th className="px-[22px] py-4 text-left text-xs font-bold uppercase tracking-wide text-gray-300">
                  Tipo
                </th>
                <th className="px-[22px] py-4 text-left text-xs font-bold uppercase tracking-wide text-gray-300">
                  Região
                </th>
                <th className="px-[22px] py-4 text-left text-xs font-bold uppercase tracking-wide text-gray-300">
                  Status
                </th>
                <th className="px-[22px] py-4 text-left text-xs font-bold uppercase tracking-wide text-gray-300">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {lista.map((org) => (
                <Fragment key={org.id}>
                  <tr className="border-b border-surface-border last:border-0">
                    <td className="px-[22px] py-4 align-middle">
                      <div className="font-bold text-brand-dark">{org.nome}</div>
                      <div className="text-xs text-gray-500">
                        Cadastro:{' '}
                        {new Date(org.created_at).toLocaleDateString('pt-BR')}
                      </div>
                    </td>
                    <td className="px-[22px] py-4 align-middle text-[13.5px] text-gray-700">
                      {labelTipoOrganizacao(org.tipo)}
                    </td>
                    <td className="px-[22px] py-4 align-middle text-[13.5px] text-gray-500">
                      {org.tem_regiao_configurada ? 'Configurada' : '— não definida'}
                    </td>
                    <td className="px-[22px] py-4 align-middle">
                      <Badge variant={statusBadgeVariant(org.status_aprovacao)}>
                        {statusLabel(org.status_aprovacao)}
                      </Badge>
                    </td>
                    <td className="px-[22px] py-4 align-middle">
                      <div className="flex flex-wrap gap-2">
                        {org.status_aprovacao === 'pendente' && (
                          <>
                            <ActionButton
                              className="bg-[#E7F8EF] text-[#1F9D55]"
                              disabled={actionLoading === org.id}
                              onClick={() => void handleStatus(org.id, 'aprovado')}
                            >
                              Aprovar
                            </ActionButton>
                            <ActionButton
                              className="bg-[#FCE9E9] text-[#E85D5D]"
                              disabled={actionLoading === org.id}
                              onClick={() => void handleStatus(org.id, 'rejeitado')}
                            >
                              Rejeitar
                            </ActionButton>
                          </>
                        )}
                        {org.status_aprovacao === 'aprovado' && (
                          <ActionButton
                            className="bg-brand-50 text-brand-500"
                            disabled={actionLoading === `regiao-${org.id}`}
                            onClick={() =>
                              setExpandedRegiaoId((current) =>
                                current === org.id ? null : org.id,
                              )
                            }
                          >
                            {org.tem_regiao_configurada
                              ? 'Editar região'
                              : 'Definir região'}
                          </ActionButton>
                        )}
                        {org.status_aprovacao === 'rejeitado' && (
                          <span className="rounded-full bg-brand-50 px-3.5 py-[7px] text-[12.5px] font-bold text-brand-500">
                            Rejeitado
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                  {org.status_aprovacao === 'aprovado' &&
                    expandedRegiaoId === org.id && (
                      <tr key={`${org.id}-regiao`} className="bg-brand-50/40">
                        <td colSpan={5} className="px-[22px] py-5">
                          <p className="mb-3 text-sm font-bold text-brand-dark">
                            Região de atuação (centro + raio)
                          </p>
                          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <Input
                              label="Latitude"
                              type="number"
                              step="any"
                              placeholder="Latitude"
                              value={regiaoForm[`${org.id}_lat`] ?? ''}
                              onChange={(e) =>
                                setCampo(org.id, 'lat', e.target.value)
                              }
                            />
                            <Input
                              label="Longitude"
                              type="number"
                              step="any"
                              placeholder="Longitude"
                              value={regiaoForm[`${org.id}_lng`] ?? ''}
                              onChange={(e) =>
                                setCampo(org.id, 'lng', e.target.value)
                              }
                            />
                            <Input
                              label="Raio (km)"
                              type="number"
                              step="any"
                              min={1}
                              placeholder="Raio (km)"
                              value={regiaoForm[`${org.id}_raio`] ?? '10'}
                              onChange={(e) =>
                                setCampo(org.id, 'raio', e.target.value)
                              }
                            />
                            <div className="flex items-end">
                              <ActionButton
                                className="w-full bg-brand-500 px-5 py-2.5 text-white sm:w-auto"
                                disabled={actionLoading === `regiao-${org.id}`}
                                onClick={() => void handleRegiao(org.id)}
                              >
                                Salvar região
                              </ActionButton>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {!loading && lista.length === 0 && (
          <p className="px-[22px] py-10 text-center text-sm text-gray-500">
            Nenhuma organização neste filtro.
          </p>
        )}
      </div>
    </section>
  )
}

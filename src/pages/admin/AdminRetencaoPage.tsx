import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { AdminBreadcrumb } from '@/components/admin/AdminBreadcrumb'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import {
  aplicarRetencao,
  definirAgendamentoRetencao,
  obterStatusRetencao,
  simularRetencao,
} from '@/lib/retencao'
import type {
  CandidatoRetencao,
  HistoricoRetencao,
  ResultadoRetencao,
  StatusRetencao,
} from '@/types/retencao'

function formatDate(value?: string | null) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString('pt-BR')
  } catch {
    return value
  }
}

function historicoLabel(modo: string) {
  if (modo === 'dry_run') return 'Dry-run executado'
  if (modo === 'aplicar') return 'Anonimização aplicada'
  return modo
}

function AdminTable({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={`overflow-x-auto rounded-card border border-surface-border bg-white shadow-card ${className}`}
    >
      <table className="min-w-full border-collapse text-left text-sm">
        {children}
      </table>
    </div>
  )
}

export function AdminRetencaoPage() {
  const [status, setStatus] = useState<StatusRetencao | null>(null)
  const [candidatos, setCandidatos] = useState<CandidatoRetencao[]>([])
  const [ultimoResultado, setUltimoResultado] =
    useState<ResultadoRetencao | null>(null)
  const [loading, setLoading] = useState(true)
  const [action, setAction] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmText, setConfirmText] = useState('')

  const carregar = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await obterStatusRetencao()
      setStatus(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar retenção')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  async function handleDryRun() {
    setAction('dry')
    setError(null)
    try {
      const result = await simularRetencao(25)
      setUltimoResultado(result)
      setCandidatos(result.candidatos_detalhe ?? [])
      await carregar()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no dry-run')
    } finally {
      setAction(null)
    }
  }

  async function handleAplicar() {
    if (confirmText !== 'APLICAR_RETENCAO') {
      setError('Digite APLICAR_RETENCAO para confirmar.')
      return
    }
    setAction('aplicar')
    setError(null)
    try {
      const result = await aplicarRetencao()
      setUltimoResultado(result)
      setCandidatos([])
      setConfirmText('')
      await carregar()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao aplicar retenção')
    } finally {
      setAction(null)
    }
  }

  async function handleToggleAgendamento(ativo: boolean) {
    setAction('toggle')
    setError(null)
    try {
      await definirAgendamentoRetencao(ativo)
      await carregar()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Falha ao alterar agendamento',
      )
    } finally {
      setAction(null)
    }
  }

  const agendamentoAtivo = status?.job_retencao?.agendamento_ativo === true
  const historico: HistoricoRetencao[] = status?.historico ?? []

  return (
    <section className="mx-auto max-w-[900px]">
      <AdminBreadcrumb current="Retenção de dados" />

      <div className="mb-6">
        <h1 className="font-display text-2xl font-extrabold text-brand-dark">
          Retenção de dados
        </h1>
        <p className="mt-1.5 max-w-[560px] text-sm leading-relaxed text-gray-500">
          Anonimiza foto, localização e dados estimados de resgates sem dono
          identificado, respeitando o prazo configurado (
          <code className="text-xs">dias_retencao_sem_dono</code>).
        </p>
      </div>

      {error && (
        <p className="mb-4 rounded-[14px] bg-brand-50 px-4 py-3 text-sm text-brand-700">
          {error}
        </p>
      )}

      {loading && !status ? (
        <p className="text-gray-500">Carregando…</p>
      ) : (
        <>
          <Card className="mb-[22px] flex flex-wrap items-center justify-between gap-5 px-7 py-[26px]">
            <div>
              <strong className="block text-[15px] text-brand-dark">
                Prazo de retenção
              </strong>
              <span className="text-[13px] text-gray-500">
                Resgates sem dono identificado são anonimizados após esse período.
              </span>
            </div>
            <div className="font-display text-[26px] font-extrabold text-brand-500">
              {status?.dias_retencao ?? '—'} dias
            </div>
          </Card>

          <div className="mb-[26px] flex flex-wrap items-center justify-between gap-4 rounded-[14px] border border-surface-border bg-white px-5 py-4">
            <div>
              <p className="text-[13.5px] font-bold text-brand-dark">
                Agendamento automático
              </p>
              <p className="text-xs text-gray-500">
                Executa a anonimização via pg_cron periodicamente (
                {status?.job_retencao?.horario_cron_utc ?? '0 3 * * *'} UTC)
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={agendamentoAtivo}
              disabled={action !== null}
              onClick={() => {
                if (agendamentoAtivo) {
                  void handleToggleAgendamento(false)
                  return
                }
                if (
                  window.confirm(
                    'Ativar anonimização automática diária (03:00 UTC)? Só faça após dry-run em staging.',
                  )
                ) {
                  void handleToggleAgendamento(true)
                }
              }}
              className={[
                'relative h-6 w-11 shrink-0 rounded-full transition-colors',
                agendamentoAtivo ? 'bg-brand-500' : 'bg-[#EDEBF6]',
              ].join(' ')}
            >
              <span
                className={[
                  'absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white shadow-sm transition-transform',
                  agendamentoAtivo ? 'translate-x-[22px]' : 'translate-x-[3px]',
                ].join(' ')}
              />
            </button>
          </div>

          <div className="mb-[26px] flex flex-wrap gap-3.5">
            <Button
              type="button"
              variant="outline"
              disabled={action !== null}
              onClick={() => void handleDryRun()}
              className="bg-brand-50"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                aria-hidden
              >
                <path d="M12 22s7-6.5 7-12a7 7 0 10-14 0c0 5.5 7 12 7 12z" />
              </svg>
              {action === 'dry' ? 'Simulando…' : 'Rodar dry-run'}
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={
                action !== null || confirmText !== 'APLICAR_RETENCAO'
              }
              onClick={() => void handleAplicar()}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                aria-hidden
              >
                <path d="M20 6L9 17l-5-5" />
              </svg>
              {action === 'aplicar' ? 'Aplicando…' : 'Aplicar anonimização'}
            </Button>
          </div>

          <Card className="mb-[34px] space-y-4 border-[#FCE9E9] bg-[#FFFBFB] p-5 sm:p-6">
            <div>
              <p className="font-display text-sm font-extrabold text-brand-dark">
                Confirmação para aplicar
              </p>
              <p className="mt-1 text-[13px] text-gray-500">
                Remove foto, localização e embedding; status →{' '}
                <code className="text-xs">anonimizado</code>. Irreversível.
              </p>
            </div>
            <Input
              label="Digite APLICAR_RETENCAO para confirmar"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="APLICAR_RETENCAO"
            />
          </Card>

          {(ultimoResultado || status?.candidatos_atuais !== undefined) && (
            <div className="mb-[34px] rounded-[14px] bg-[#FFF6DD] px-5 py-[18px] text-[13.5px] text-[#B7791F]">
              <strong className="mb-1 block text-sm">
                Resultado do último dry-run / simulação
              </strong>
              {ultimoResultado ? (
                <>
                  {ultimoResultado.candidatos} registro(s) elegíveis (
                  {ultimoResultado.modo}) — {ultimoResultado.anonimizados}{' '}
                  anonimizado(s) se aplicado. Prazo: {ultimoResultado.dias_retencao}{' '}
                  dias.
                </>
              ) : (
                <>
                  {status?.candidatos_atuais ?? 0} candidato(s) no momento. Rode
                  dry-run para ver amostra detalhada.
                </>
              )}
            </div>
          )}

          <div className="mb-4 flex items-start gap-3 rounded-[14px] bg-[#FFF6DD] px-5 py-4 text-[13px] text-[#B7791F]">
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="mt-0.5 shrink-0"
              aria-hidden
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v5M12 16h.01" />
            </svg>
            <p>
              <strong>Staging antes de produção.</strong> Rode dry-run, confira a
              amostra e só então aplique ou ative o agendamento. Com{' '}
              <code>agendamento_ativo=false</code> o cron diário é no-op.
            </p>
          </div>

          {candidatos.length > 0 && (
            <AdminTable className="mb-8">
              <thead>
                <tr className="border-b border-surface-border">
                  <th className="px-[22px] py-4 text-xs font-bold uppercase tracking-wide text-gray-300">
                    ID
                  </th>
                  <th className="px-[22px] py-4 text-xs font-bold uppercase tracking-wide text-gray-300">
                    Status
                  </th>
                  <th className="px-[22px] py-4 text-xs font-bold uppercase tracking-wide text-gray-300">
                    Criado em
                  </th>
                  <th className="px-[22px] py-4 text-xs font-bold uppercase tracking-wide text-gray-300">
                    Foto
                  </th>
                  <th className="px-[22px] py-4 text-xs font-bold uppercase tracking-wide text-gray-300">
                    GPS
                  </th>
                </tr>
              </thead>
              <tbody>
                {candidatos.map((c) => (
                  <tr key={c.id} className="border-b border-surface-border last:border-0">
                    <td className="px-[22px] py-4 font-mono text-xs text-gray-600">
                      {c.id.slice(0, 8)}…
                    </td>
                    <td className="px-[22px] py-4 text-[13.5px] text-gray-700">
                      {c.status}
                    </td>
                    <td className="px-[22px] py-4 text-[13.5px] text-gray-600">
                      {formatDate(c.created_at)}
                    </td>
                    <td className="px-[22px] py-4 text-[13.5px] text-gray-600">
                      {c.tem_foto ? 'sim' : 'não'}
                    </td>
                    <td className="px-[22px] py-4 text-[13.5px] text-gray-600">
                      {c.tem_localizacao ? 'sim' : 'não'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </AdminTable>
          )}

          {historico.length > 0 && (
            <div>
              <h2 className="mb-4 font-display text-base font-extrabold text-brand-dark">
                Histórico de execuções
              </h2>
              <AdminTable>
                <thead>
                  <tr className="border-b border-surface-border">
                    <th className="px-[22px] py-4 text-xs font-bold uppercase tracking-wide text-gray-300">
                      Execução
                    </th>
                    <th className="px-[22px] py-4 text-xs font-bold uppercase tracking-wide text-gray-300">
                      Disparado por
                    </th>
                    <th className="px-[22px] py-4 text-xs font-bold uppercase tracking-wide text-gray-300">
                      Candidatos
                    </th>
                    <th className="px-[22px] py-4 text-xs font-bold uppercase tracking-wide text-gray-300">
                      Anonimizados
                    </th>
                    <th className="px-[22px] py-4 text-xs font-bold uppercase tracking-wide text-gray-300">
                      Data
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {historico.map((h) => (
                    <tr
                      key={h.id}
                      className="border-b border-surface-border last:border-0"
                    >
                      <td className="px-[22px] py-4">
                        <div className="flex items-center gap-3">
                          <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-[#E7F8EF]">
                            <svg
                              width="15"
                              height="15"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="#1F9D55"
                              strokeWidth="2"
                              aria-hidden
                            >
                              <path d="M20 6L9 17l-5-5" />
                            </svg>
                          </span>
                          <span className="text-[13.5px] font-bold text-brand-dark">
                            {historicoLabel(h.modo)}
                          </span>
                        </div>
                      </td>
                      <td className="px-[22px] py-4 text-[13.5px] text-gray-600">
                        {h.disparado_por}
                      </td>
                      <td className="px-[22px] py-4 text-[13.5px] font-bold text-gray-500">
                        {h.candidatos}
                      </td>
                      <td className="px-[22px] py-4 text-[13.5px] font-bold text-gray-500">
                        {h.anonimizados}
                      </td>
                      <td className="px-[22px] py-4 text-xs text-gray-300">
                        {formatDate(h.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </AdminTable>
            </div>
          )}
        </>
      )}
    </section>
  )
}

import { useCallback, useEffect, useState } from 'react'
import { OrgaoAlertasList } from '@/components/orgao/OrgaoAlertasList'
import { OrgaoIndicadores } from '@/components/orgao/OrgaoIndicadores'
import { ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useAuth } from '@/contexts/AuthContext'
import { fetchPainelOrganizacao, labelTipoOrganizacao } from '@/lib/orgao'
import type { PainelOrganizacao } from '@/types/orgao'

const PERIODOS = [7, 30, 90] as const

function OrgBuildingIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#6C4FE0"
      strokeWidth="1.8"
      aria-hidden
    >
      <path d="M4 21V9l8-6 8 6v12" />
      <path d="M9 21v-6h6v6" />
    </svg>
  )
}

function WarningIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#B7791F"
      strokeWidth="2"
      className="shrink-0"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5M12 16h.01" />
    </svg>
  )
}

function HeartIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden
    >
      <path d="M12 21s-7-4.5-9.5-9C.5 8 2 4 6 4c2 0 3.5 1 4 2.5C10.5 5 12 4 14 4c4 0 5.5 4 3.5 8-2.5 4.5-9.5 9-9.5 9z" />
    </svg>
  )
}

export function OrgaoDashboardPage() {
  const { user } = useAuth()
  const organizacaoId = user?.organizacao?.id

  const [dias, setDias] = useState<number>(30)
  const [painel, setPainel] = useState<PainelOrganizacao | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    if (!organizacaoId) return

    setLoading(true)
    setError(null)

    try {
      const data = await fetchPainelOrganizacao(organizacaoId, dias)
      setPainel(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar painel')
    } finally {
      setLoading(false)
    }
  }, [organizacaoId, dias])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const orgNome = user?.organizacao?.nome ?? painel?.organizacao.nome ?? 'Organização'
  const orgTipo = user?.organizacao?.tipo ?? painel?.organizacao.tipo
  const alertasCount = painel?.alertas.length ?? 0

  return (
    <section className="space-y-7">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-center gap-3.5">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-brand-50">
            <OrgBuildingIcon />
          </span>
          <div>
            <h1 className="font-display text-[22px] font-extrabold text-brand-dark">
              {orgNome}
            </h1>
            {orgTipo && (
              <p className="text-[13px] text-gray-500">
                {labelTipoOrganizacao(orgTipo)}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <div
            className="inline-flex w-fit rounded-full border border-surface-border bg-white p-1"
            role="group"
            aria-label="Período do painel"
          >
            {PERIODOS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setDias(p)}
                className={[
                  'rounded-full px-3.5 py-2 text-[13px] font-bold transition-colors',
                  dias === p
                    ? 'bg-brand-500 text-white'
                    : 'bg-transparent text-gray-500 hover:text-brand-500',
                ].join(' ')}
              >
                {p} dias
              </button>
            ))}
          </div>

          <ButtonLink
            to="/orgao/encontrei"
            variant="primary"
            size="sm"
            className="w-full justify-center sm:w-auto"
          >
            <HeartIcon />
            Encontrei um animal
          </ButtonLink>
        </div>
      </div>

      {loading && (
        <p className="text-sm text-gray-500">Carregando painel…</p>
      )}
      {error && (
        <p className="rounded-[14px] bg-brand-50 px-4 py-3 text-sm text-brand-700">
          {error}
        </p>
      )}

      {painel?.aviso && (
        <div
          className="flex items-center gap-3 rounded-[14px] border border-[#F0E4B8] bg-[#FFF6DD] px-[18px] py-3.5 text-[13.5px] text-[#B7791F]"
          role="status"
        >
          <WarningIcon />
          <span>{painel.aviso}</span>
        </div>
      )}

      {painel && (
        <>
          <OrgaoIndicadores indicadores={painel.indicadores} />

          <Card className="border border-surface-border px-6 py-6 shadow-card sm:px-7 sm:py-[26px]">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="font-display text-base font-extrabold text-brand-dark">
                  Alertas próximos
                </h2>
                <p className="mt-1 text-[13px] leading-relaxed text-gray-500">
                  Animais perdidos e resgates na área de atuação — sem dados de
                  contato do tutor.
                </p>
              </div>
              {alertasCount > 0 && (
                <span className="rounded-full bg-brand-50 px-3 py-1 text-[12px] font-bold text-brand-500">
                  {alertasCount} alerta{alertasCount > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <OrgaoAlertasList alertas={painel.alertas} />
          </Card>
        </>
      )}
    </section>
  )
}

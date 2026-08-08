import type { ReactNode } from 'react'
import type { IndicadoresOrganizacao } from '@/types/orgao'

interface OrgaoIndicadoresProps {
  indicadores: IndicadoresOrganizacao
}

function MetricCard({
  label,
  value,
  hint,
  icon,
  featured = false,
  featuredAlt = false,
}: {
  label: string
  value: number
  hint?: string
  icon: ReactNode
  featured?: boolean
  featuredAlt?: boolean
}) {
  if (featured) {
    return (
      <div
        className={[
          'rounded-card px-[26px] py-[22px] text-white shadow-[0_10px_24px_rgba(108,79,224,0.25)]',
          featuredAlt ? 'bg-brand-vivid' : 'bg-brand-500',
        ].join(' ')}
      >
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white">
          {icon}
        </div>
        <p className="font-display text-[30px] font-extrabold leading-none">
          {value}
        </p>
        <p className="mt-1 text-[13px] font-bold opacity-90">{label}</p>
        {hint && <p className="mt-1.5 text-xs opacity-85">{hint}</p>}
      </div>
    )
  }

  return (
    <div className="flex items-start gap-3.5 rounded-card border border-surface-border bg-white p-[22px] shadow-card">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-500">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-display text-[30px] font-extrabold leading-none text-brand-dark">
          {value}
        </p>
        <p className="mt-1 text-[13px] font-bold text-brand-dark">{label}</p>
        {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
      </div>
    </div>
  )
}

export function OrgaoIndicadores({ indicadores }: OrgaoIndicadoresProps) {
  const periodo = indicadores.periodo_dias

  return (
    <div className="space-y-[18px]">
      <div className="grid gap-[18px] sm:grid-cols-2">
        <MetricCard
          featured
          label="Resgates no período"
          value={indicadores.resgates_periodo}
          hint={`Últimos ${periodo} dias`}
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M12 21s-7-4.5-9.5-9C.5 8 2 4 6 4c2 0 3.5 1 4 2.5C10.5 5 12 4 14 4c4 0 5.5 4 3.5 8-2.5 4.5-9.5 9-9.5 9z" />
            </svg>
          }
        />
        <MetricCard
          featured
          featuredAlt
          label="Perdidos no período"
          value={indicadores.perdidos_periodo}
          hint={`Últimos ${periodo} dias`}
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <path d="M12 22s7-6.5 7-12a7 7 0 10-14 0c0 5.5 7 12 7 12z" />
              <circle cx="12" cy="10" r="2.5" />
            </svg>
          }
        />
      </div>

      <div className="grid gap-[18px] sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          label="Perdidos em aberto"
          value={indicadores.perdidos_abertos}
          hint="Na sua região agora"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v5M12 16h.01" />
            </svg>
          }
        />
        <MetricCard
          label="Resgates disponíveis"
          value={indicadores.resgates_disponiveis}
          hint="Aguardando análise"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <path d="M4 19h16M6 16V9M12 16V5M18 16v-4" />
            </svg>
          }
        />
        <MetricCard
          label="Resgates da organização"
          value={indicadores.resgates_da_organizacao}
          hint={`Registrados por vocês (${periodo}d)`}
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6" />
            </svg>
          }
        />
      </div>
    </div>
  )
}

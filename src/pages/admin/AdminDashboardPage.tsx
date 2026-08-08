import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchAdminOverviewStats, type AdminOverviewStats } from '@/lib/admin'

const modules = [
  {
    to: '/admin/campos-pet',
    title: 'Campos do pet',
    description:
      'Editar os campos configuráveis do formulário de cadastro de animais.',
    cta: 'Gerenciar campos',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6C4FE0" strokeWidth="1.8" aria-hidden>
        <path d="M4 6h16M4 12h16M4 18h10" />
      </svg>
    ),
  },
  {
    to: '/admin/organizacoes',
    title: 'Organizações',
    description:
      'Aprovar cadastros, definir região de atuação e gerenciar órgãos parceiros.',
    cta: 'Gerenciar organizações',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6C4FE0" strokeWidth="1.8" aria-hidden>
        <path d="M4 21V9l8-6 8 6v12" />
        <path d="M9 21v-6h6v6" />
      </svg>
    ),
  },
  {
    to: '/admin/retencao',
    title: 'Retenção de dados',
    description:
      'Executar dry-run e aplicar a anonimização de resgates sem dono identificado.',
    cta: 'Gerenciar retenção',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6C4FE0" strokeWidth="1.8" aria-hidden>
        <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" />
      </svg>
    ),
  },
] as const

const overviewLabels: Record<keyof AdminOverviewStats, string> = {
  petsCadastrados: 'Pets cadastrados',
  resgatesRegistrados: 'Resgates registrados',
  matchesPendentes: 'Matches pendentes',
  notificacoesNaFila: 'Notificações na fila',
}

function formatStat(value: number) {
  return value.toLocaleString('pt-BR')
}

export function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminOverviewStats | null>(null)
  const [statsError, setStatsError] = useState(false)

  useEffect(() => {
    void fetchAdminOverviewStats()
      .then(setStats)
      .catch(() => setStatsError(true))
  }, [])

  return (
    <section>
      <div className="mb-8">
        <h1 className="font-display text-[25px] font-extrabold text-brand-dark">
          Painel administrativo
        </h1>
        <p className="mt-1.5 text-sm text-gray-500">
          Gerencie configurações da plataforma, organizações parceiras e políticas
          de retenção.
        </p>
      </div>

      <div className="mb-[34px] grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(Object.keys(overviewLabels) as Array<keyof AdminOverviewStats>).map(
          (key) => (
            <div
              key={key}
              className="rounded-[14px] border border-surface-border bg-white px-5 py-[18px] shadow-card"
            >
              <div className="font-display text-[22px] font-extrabold text-brand-dark">
                {statsError
                  ? '—'
                  : stats
                    ? formatStat(stats[key])
                    : '…'}
              </div>
              <div className="mt-0.5 text-[12.5px] text-gray-500">
                {overviewLabels[key]}
              </div>
            </div>
          ),
        )}
      </div>

      <div className="grid gap-[22px] sm:grid-cols-2 lg:grid-cols-3">
        {modules.map((mod) => (
          <Link
            key={mod.to}
            to={mod.to}
            className="group block rounded-card border border-surface-border bg-white p-7 shadow-card transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-soft"
          >
            <span className="mb-[18px] flex h-12 w-12 items-center justify-center rounded-[14px] bg-brand-50">
              {mod.icon}
            </span>
            <h2 className="font-display text-[16.5px] font-extrabold text-brand-dark">
              {mod.title}
            </h2>
            <p className="mb-[18px] mt-2 text-[13.5px] leading-relaxed text-gray-500">
              {mod.description}
            </p>
            <span className="flex items-center gap-1.5 text-[13px] font-bold text-brand-500">
              {mod.cta}
              <span aria-hidden>→</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}

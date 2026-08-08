import { labelStatusOrganizacao } from '@/lib/orgao'
import type { AlertaOrganizacao } from '@/types/orgao'

interface OrgaoAlertasListProps {
  alertas: AlertaOrganizacao[]
}

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60_000)

  if (mins < 1) return 'agora'
  if (mins < 60) return `${mins} min atrás`

  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} h atrás`

  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} dia${days > 1 ? 's' : ''} atrás`

  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function alertLocation(alerta: AlertaOrganizacao): string | null {
  return (
    alerta.regiao_aproximada ??
    alerta.endereco_aproximado ??
    null
  )
}

function AlertIcon({ tipo }: { tipo: AlertaOrganizacao['tipo'] }) {
  if (tipo === 'perdido') {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <path d="M12 22s7-6.5 7-12a7 7 0 10-14 0c0 5.5 7 12 7 12z" />
        <circle cx="12" cy="10" r="2.5" />
      </svg>
    )
  }

  if (tipo === 'resgate') {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M12 21s-7-4.5-9.5-9C.5 8 2 4 6 4c2 0 3.5 1 4 2.5C10.5 5 12 4 14 4c4 0 5.5 4 3.5 8-2.5 4.5-9.5 9-9.5 9z" />
      </svg>
    )
  }

  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
    </svg>
  )
}

export function OrgaoAlertasList({ alertas }: OrgaoAlertasListProps) {
  if (alertas.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-gray-500">
        Nenhum alerta na região no momento.
      </p>
    )
  }

  return (
    <ul className="space-y-2.5">
      {alertas.map((alerta) => {
        const location = alertLocation(alerta)
        const timeLine = [location, formatRelativeTime(alerta.created_at)]
          .filter(Boolean)
          .join(' · ')

        const detail =
          alerta.tipo === 'perdido'
            ? [alerta.especie, alerta.porte, alerta.cor]
                .filter(Boolean)
                .join(' · ') || null
            : [alerta.porte_estimado, alerta.cor].filter(Boolean).join(' · ') ||
              null

        return (
          <li
            key={`${alerta.tipo}-${alerta.id}`}
            className="flex items-start gap-3 rounded-[14px] border border-surface-border bg-white px-3.5 py-3 shadow-card"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-500">
              <AlertIcon tipo={alerta.tipo} />
            </span>
            <div className="min-w-0 flex-1 text-left">
              <strong className="block text-[13.5px] text-brand-dark">
                {alerta.titulo}
              </strong>
              {timeLine && (
                <span className="mt-0.5 block text-xs text-gray-300">
                  {timeLine}
                </span>
              )}
              {detail && (
                <span className="mt-0.5 block text-xs text-gray-500">
                  {detail}
                </span>
              )}
              {alerta.descricao_resumo && (
                <span className="mt-0.5 block text-xs text-gray-400">
                  {alerta.descricao_resumo}
                </span>
              )}
              <span className="mt-1 block text-[11px] font-semibold text-gray-400">
                {labelStatusOrganizacao(alerta.status)}
              </span>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

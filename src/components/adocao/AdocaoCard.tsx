import { Link } from 'react-router-dom'
import {
  labelEspecie,
  labelPorte,
  labelStatus,
} from '@/lib/adocao'
import type { ListagemAdocaoCard } from '@/types/adocao'

export function AdocaoCard({ item }: { item: ListagemAdocaoCard }) {
  return (
    <Link
      to={`/tutor/adocao/${item.id}`}
      className="group flex flex-col overflow-hidden rounded-[16px] border border-surface-border bg-white shadow-card transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-soft"
    >
      <div className="aspect-[4/3] overflow-hidden bg-brand-50">
        {item.foto_url ? (
          <img
            src={item.foto_url}
            alt={item.nome}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-brand-500">
            <PawIcon />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-[16px] font-extrabold text-brand-dark">
            {item.nome}
          </h3>
          <span className="shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-600">
            {labelStatus(item.status)}
          </span>
        </div>
        <p className="text-[12.5px] text-gray-500">
          {labelEspecie(item.especie)}
          {item.raca ? ` · ${item.raca}` : ''}
          {item.porte ? ` · ${labelPorte(item.porte)}` : ''}
        </p>
        {(item.cidade_preferencial || item.regiao_preferencial) && (
          <p className="mt-auto text-[12px] font-semibold text-brand-700">
            {[item.cidade_preferencial, item.estado_preferencial]
              .filter(Boolean)
              .join(' — ')}
          </p>
        )}
      </div>
    </Link>
  )
}

function PawIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 14.5c-3.5 0-6.5 2.2-6.5 5.2 0 1.1.9 1.8 2 1.6 1.4-.3 2.9-.5 4.5-.5s3.1.2 4.5.5c1.1.2 2-.5 2-1.6 0-3-3-5.2-6.5-5.2z" />
      <circle cx="6" cy="9" r="2.2" />
      <circle cx="18" cy="9" r="2.2" />
      <circle cx="9.5" cy="5.5" r="2" />
      <circle cx="14.5" cy="5.5" r="2" />
    </svg>
  )
}

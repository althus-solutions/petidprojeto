import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AdocaoCard } from '@/components/adocao/AdocaoCard'
import { AdocaoFiltersPanel } from '@/components/adocao/AdocaoFilters'
import { TelecaoPartnershipBadge } from '@/components/adocao/TelecaoPartnershipBadge'
import { listListagensAdocao } from '@/lib/adocao'
import type { AdocaoFilters, ListagemAdocaoCard } from '@/types/adocao'

const emptyFilters: AdocaoFilters = {}

export function TutorAdocaoPage() {
  const [filters, setFilters] = useState<AdocaoFilters>(emptyFilters)
  const [items, setItems] = useState<ListagemAdocaoCard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const data = await listListagensAdocao(filters)
        if (!cancelled) setItems(data)
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Não foi possível carregar a galeria. Aplique a migration 039.',
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [filters])

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <TelecaoPartnershipBadge />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-[22px] font-extrabold text-brand-dark">
            Adoção
          </h1>
          <p className="mt-0.5 text-[13px] text-gray-500">
            Encontre um lar ou divulgue um animal para adoção, com apoio da
            TeleCão.
          </p>
        </div>
        <Link
          to="/tutor/adocao/novo"
          className="inline-flex items-center justify-center rounded-[12px] bg-telecao-500 px-4 py-2.5 text-[13.5px] font-extrabold text-white shadow-md hover:bg-telecao-600"
        >
          Cadastrar para adoção
        </Link>
      </div>

      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setFiltersOpen((o) => !o)}
          className="w-full rounded-[12px] border border-surface-border bg-white px-4 py-2.5 text-[13px] font-bold text-brand-700"
        >
          {filtersOpen ? 'Ocultar filtros' : 'Mostrar filtros'}
        </button>
        {filtersOpen && (
          <AdocaoFiltersPanel
            className="mt-3"
            value={filters}
            onChange={setFilters}
            onClear={() => setFilters(emptyFilters)}
          />
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
        <AdocaoFiltersPanel
          className="hidden lg:block"
          value={filters}
          onChange={setFilters}
          onClear={() => setFilters(emptyFilters)}
        />

        <div>
          {loading && <p className="text-sm text-gray-500">Carregando…</p>}
          {error && (
            <p className="rounded-[12px] bg-brand-50 px-4 py-3 text-sm text-brand-700">
              {error}
            </p>
          )}
          {!loading && !error && items.length === 0 && (
            <div className="rounded-[16px] border border-dashed border-surface-border bg-white/80 px-6 py-12 text-center">
              <p className="font-display text-[16px] font-bold text-brand-dark">
                Nenhum animal encontrado
              </p>
              <p className="mt-1 text-[13px] text-gray-500">
                Ajuste os filtros ou cadastre o primeiro anúncio.
              </p>
                <Link
                  to="/tutor/adocao/novo"
                  className="mt-4 inline-flex rounded-[12px] bg-telecao-500 px-4 py-2.5 text-[13px] font-extrabold text-white hover:bg-telecao-600"
                >
                  Cadastrar para adoção
                </Link>
            </div>
          )}
          {!loading && items.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((item) => (
                <AdocaoCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useAuth } from '@/contexts/AuthContext'
import {
  getResgatePhotoSignedUrl,
  labelStatusAnimalOrg,
  listarAnimaisOrganizacao,
} from '@/lib/orgao-animais'
import { labelTipoOrganizacao } from '@/lib/orgao'
import type { AnimalOrganizacao } from '@/types/orgao-animais'

type ItemComFoto = AnimalOrganizacao & { fotoSigned?: string | null }

export function OrgaoAnimaisPage() {
  const { user } = useAuth()
  const isPrefeitura = user?.organizacao?.tipo === 'prefeitura'
  const orgId = user?.organizacao?.id

  const [itens, setItens] = useState<ItemComFoto[]>([])
  const [filtroOrg, setFiltroOrg] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const lista = await listarAnimaisOrganizacao(
        isPrefeitura ? null : orgId,
      )
      const comFotos = await Promise.all(
        lista.map(async (a) => ({
          ...a,
          fotoSigned: await getResgatePhotoSignedUrl(a.foto_url),
        })),
      )
      setItens(comFotos)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível carregar o inventário.',
      )
    } finally {
      setLoading(false)
    }
  }, [isPrefeitura, orgId])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const orgsFiltro = useMemo(() => {
    const map = new Map<string, string>()
    for (const a of itens) {
      if (a.organizacao_id && a.organizacao_nome) {
        map.set(a.organizacao_id, a.organizacao_nome)
      }
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'))
  }, [itens])

  const itensVisiveis = useMemo(() => {
    if (!isPrefeitura || !filtroOrg) return itens
    return itens.filter((a) => a.organizacao_id === filtroOrg)
  }, [filtroOrg, isPrefeitura, itens])

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[13px] font-semibold text-gray-500">
            <Link to="/orgao" className="text-brand-500 hover:underline">
              Painel
            </Link>
            {' · '}
            Animais
          </p>
          <h1 className="mt-1 font-display text-[22px] font-extrabold text-brand-dark">
            {isPrefeitura
              ? 'Inventário regional'
              : 'Animais da organização'}
          </h1>
          <p className="mt-1 max-w-xl text-[13.5px] leading-relaxed text-gray-500">
            {isPrefeitura
              ? 'Visão consolidada dos animais cadastrados por ONGs e órgãos parceiros aprovados.'
              : 'Banco de animais registrados pela sua entidade (resgates e cadastros manuais).'}
          </p>
        </div>

        <ButtonLink
          to="/orgao/animais/novo"
          variant="primary"
          size="sm"
          className="w-full justify-center sm:w-auto"
        >
          Cadastrar animal
        </ButtonLink>
      </div>

      {isPrefeitura && (
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-[220px] flex-1 flex-col gap-1.5 text-[13px] font-bold text-brand-dark">
            Filtrar por organização
            <select
              className="rounded-[12px] border border-surface-border bg-white px-3 py-2.5 text-[14px] font-normal text-gray-800"
              value={filtroOrg}
              onChange={(e) => setFiltroOrg(e.target.value)}
            >
              <option value="">Todas as organizações</option>
              {orgsFiltro.map(([id, nome]) => (
                <option key={id} value={id}>
                  {nome}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {loading && (
        <p className="text-sm text-gray-500">Carregando inventário…</p>
      )}
      {error && (
        <p className="rounded-[14px] bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {!loading && !error && itensVisiveis.length === 0 && (
        <Card className="border border-surface-border px-6 py-10 text-center shadow-card">
          <p className="text-sm text-gray-500">
            Nenhum animal cadastrado ainda. Use “Encontrei um animal” ou
            “Cadastrar animal” para começar.
          </p>
        </Card>
      )}

      <ul className="grid gap-3 sm:grid-cols-2">
        {itensVisiveis.map((a) => (
          <li key={a.id}>
            <Card className="flex gap-3.5 border border-surface-border p-3.5 shadow-card">
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-[12px] bg-brand-50">
                {a.fotoSigned ? (
                  <img
                    src={a.fotoSigned}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-[11px] text-gray-400">
                    Sem foto
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-[15px] font-extrabold text-brand-dark">
                  {a.nome?.trim() || 'Sem nome'}
                </p>
                <p className="mt-0.5 truncate text-[12.5px] text-gray-500">
                  {[a.especie, a.porte, a.cor].filter(Boolean).join(' · ') ||
                    'Características não informadas'}
                </p>
                {a.microchip && (
                  <p className="mt-1 font-mono text-[12px] text-brand-700">
                    Chip: {a.microchip}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand-500">
                    {labelStatusAnimalOrg(a.status)}
                  </span>
                  {isPrefeitura && a.organizacao_nome && (
                    <span className="truncate rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">
                      {a.organizacao_nome}
                      {a.organizacao_tipo
                        ? ` · ${labelTipoOrganizacao(a.organizacao_tipo)}`
                        : ''}
                    </span>
                  )}
                </div>
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  )
}

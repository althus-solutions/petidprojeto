import { useEffect, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { TelecaoPartnershipBadge } from '@/components/adocao/TelecaoPartnershipBadge'
import { useAuth } from '@/contexts/AuthContext'
import {
  getAdocaoPhotoSignedUrl,
  getListagemAdocao,
  jaManifestouInteresse,
  labelEspecie,
  labelPorte,
  labelStatus,
  listAdocaoMidia,
  manifestarInteresseAdocao,
} from '@/lib/adocao'
import type { ListagemAdocaoCard } from '@/types/adocao'

export function TutorAdocaoDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const [item, setItem] = useState<ListagemAdocaoCard | null>(null)
  const [photos, setPhotos] = useState<string[]>([])
  const [photoIndex, setPhotoIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [jaInteressado, setJaInteressado] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (!id) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const data = await getListagemAdocao(id)
        if (cancelled) return
        if (!data) {
          setError('Anúncio não encontrado')
          return
        }
        setItem(data)

        const midia = data.midia ?? (await listAdocaoMidia(id))
        const urls = (
          await Promise.all(
            midia
              .filter((m) => m.tipo === 'foto')
              .map((m) => getAdocaoPhotoSignedUrl(m.storage_path)),
          )
        ).filter((u): u is string => Boolean(u))
        if (!cancelled) setPhotos(urls)

        if (user?.tutor?.id) {
          const ja = await jaManifestouInteresse(id, user.tutor.id)
          if (!cancelled) setJaInteressado(ja)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Erro ao carregar')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [id, user?.tutor?.id])

  const isOwner = Boolean(
    item && user?.tutor?.id && item.tutor_id === user.tutor.id,
  )

  async function handleInteresse() {
    if (!id) return
    setSubmitting(true)
    setError(null)
    try {
      await manifestarInteresseAdocao(id, msg.trim() || undefined)
      setDone(true)
      setJaInteressado(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível enviar')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div>
        <p className="text-sm text-gray-500">Carregando…</p>
      </div>
    )
  }

  if (error && !item) {
    return (
      <div>
        <p className="text-sm text-red-600">{error}</p>
        <Link to="/tutor/adocao" className="mt-3 inline-block font-bold text-brand-600">
          ← Galeria
        </Link>
      </div>
    )
  }

  if (!item) return null

  return (
    <div>
      <div className="mx-auto max-w-2xl space-y-4">
        <Link
          to="/tutor/adocao"
          className="text-[13px] font-bold text-brand-600 hover:underline"
        >
          ← Voltar à galeria
        </Link>

        <TelecaoPartnershipBadge />

        <div className="overflow-hidden rounded-[16px] border border-surface-border border-t-[4px] border-t-telecao-500 bg-white shadow-card">
          <div className="aspect-[4/3] bg-brand-50">
            {photos[photoIndex] ? (
              <img
                src={photos[photoIndex]}
                alt={item.nome}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-gray-500">
                Sem foto
              </div>
            )}
          </div>
          {photos.length > 1 && (
            <div className="flex gap-2 overflow-x-auto px-3 py-2">
              {photos.map((src, i) => (
                <button
                  key={src}
                  type="button"
                  onClick={() => setPhotoIndex(i)}
                  className={[
                    'h-14 w-14 shrink-0 overflow-hidden rounded-[8px] border-2',
                    i === photoIndex
                      ? 'border-brand-500'
                      : 'border-transparent',
                  ].join(' ')}
                >
                  <img src={src} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}

          <div className="space-y-4 px-5 py-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h1 className="font-display text-[24px] font-extrabold text-brand-dark">
                  {item.nome}
                </h1>
                <p className="mt-1 text-[13px] text-gray-500">
                  {labelEspecie(item.especie)}
                  {item.raca ? ` · ${item.raca}` : ''}
                  {item.porte ? ` · ${labelPorte(item.porte)}` : ''}
                  {item.idade_faixa ? ` · ${item.idade_faixa}` : ''}
                </p>
              </div>
              <span className="rounded-full bg-brand-50 px-3 py-1 text-[11px] font-bold uppercase text-brand-600">
                {labelStatus(item.status)}
              </span>
            </div>

            <InfoBlock title="Saúde e temperamento">
              <Row label="Castrado" value={item.castrado ?? '—'} />
              <Row label="Vacinado" value={item.vacinado ?? '—'} />
              <Row label="Energia" value={item.energia ?? '—'} />
              <Row label="Com crianças" value={item.sociavel_criancas ?? '—'} />
              <Row label="Com cães" value={item.sociavel_caes ?? '—'} />
              <Row label="Com gatos" value={item.sociavel_gatos ?? '—'} />
            </InfoBlock>

            <InfoBlock title="Requisitos">
              <Row
                label="Moradia"
                value={
                  item.moradia_recomendada === 'casa_quintal'
                    ? 'Casa com quintal'
                    : item.moradia_recomendada === 'apartamento'
                      ? 'Apartamento'
                      : item.moradia_recomendada ?? '—'
                }
              />
              <Row
                label="Região"
                value={
                  [item.cidade_preferencial, item.estado_preferencial]
                    .filter(Boolean)
                    .join(' — ') || '—'
                }
              />
              {item.observacoes_protetor && (
                <p className="mt-2 text-[13px] leading-relaxed text-gray-500">
                  {item.observacoes_protetor}
                </p>
              )}
            </InfoBlock>

            <InfoBlock title="Responsável">
              <Row label="Nome" value={item.responsavel_nome ?? '—'} />
              {item.taxa_adocao_aplica && (
                <Row
                  label="Taxa"
                  value={
                    item.taxa_adocao_valor != null
                      ? `R$ ${Number(item.taxa_adocao_valor).toFixed(2)}`
                      : 'Aplicável'
                  }
                />
              )}
            </InfoBlock>

            {isOwner ? (
              <div className="rounded-[12px] bg-brand-50 px-4 py-3 text-[13px] text-brand-700">
                Este é o seu anúncio.{' '}
                <Link
                  to={`/tutor/adocao/${item.id}/editar`}
                  className="font-bold underline"
                >
                  Editar
                </Link>
              </div>
            ) : done || jaInteressado ? (
              <div className="rounded-[12px] bg-[#E7F8EF] px-4 py-4 text-[#1F9D55]">
                <p className="font-display text-[16px] font-extrabold">
                  Interesse enviado
                </p>
                <p className="mt-1 text-[13px] leading-relaxed">
                  O responsável foi notificado. Em breve poderá entrar em
                  contato com você pela plataforma.
                </p>
              </div>
            ) : (
              <div className="space-y-3 rounded-[14px] border border-telecao-200 bg-telecao-50 p-4">
                <h2 className="font-display text-[16px] font-extrabold text-telecao-dark">
                  Quer adotar?
                </h2>
                <textarea
                  className="w-full rounded-[10px] border border-[#E5E5E5] bg-white px-3 py-2.5 text-[13px] outline-none focus:border-telecao-500"
                  rows={3}
                  placeholder="Mensagem opcional para o responsável…"
                  value={msg}
                  onChange={(e) => setMsg(e.target.value)}
                />
                {error && (
                  <p className="text-[13px] text-red-600">{error}</p>
                )}
                <button
                  type="button"
                  disabled={submitting || item.status === 'adotado'}
                  onClick={() => void handleInteresse()}
                  className="w-full rounded-[12px] bg-telecao-500 py-3 text-[14px] font-extrabold text-white hover:bg-telecao-600 disabled:opacity-60"
                >
                  {submitting ? 'Enviando…' : 'Tenho interesse'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoBlock({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <div>
      <h2 className="mb-2 font-display text-[14px] font-extrabold text-brand-dark">
        {title}
      </h2>
      <div className="rounded-[12px] bg-[#FAFAFA] px-3.5 py-2">{children}</div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-[#EFEFEF] py-2 text-[13px] last:border-0">
      <span className="text-gray-500">{label}</span>
      <span className="text-right font-semibold capitalize text-brand-dark">
        {value.replace(/_/g, ' ')}
      </span>
    </div>
  )
}

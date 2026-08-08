import { useCallback, useEffect, useState } from 'react'
import {
  atualizarStatusMatch,
  listarMatchesTutor,
  signedResgateFotoUrl,
} from '@/lib/matches'
import { getAnimalById, getPetPhotoSignedUrl } from '@/lib/pets'
import { TutorBackLink } from '@/components/tutor/TutorBackLink'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { PawIcon } from '@/components/ui/PawIcon'
import type { MatchTutor } from '@/types/match'

function scoreBadgeVariant(score: number): 'success' | 'brand' {
  return score >= 70 ? 'success' : 'brand'
}

function MatchPhoto({
  src,
  label,
  alt,
}: {
  src: string | null
  label: string
  alt: string
}) {
  return (
    <div className="flex-1 space-y-2">
      <p className="text-center text-xs font-bold uppercase tracking-wide text-gray-400">
        {label}
      </p>
      <div className="flex aspect-square items-center justify-center overflow-hidden rounded-2xl bg-brand-50 text-brand-500">
        {src ? (
          <img src={src} alt={alt} className="h-full w-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-1 text-gray-400">
            <PawIcon className="h-8 w-8 opacity-40" />
            <span className="text-xs">Sem foto</span>
          </div>
        )}
      </div>
    </div>
  )
}

export function TutorMatchesPage() {
  const [matches, setMatches] = useState<MatchTutor[]>([])
  const [fotosResgate, setFotosResgate] = useState<Record<string, string>>({})
  const [fotosPet, setFotosPet] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionId, setActionId] = useState<string | null>(null)

  const carregar = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setError(null)
    try {
      const data = await listarMatchesTutor('sugerido')
      if (signal?.aborted) return
      setMatches(data)

      const resgateUrls: Record<string, string> = {}
      const petUrls: Record<string, string> = {}

      await Promise.all(
        data.map(async (m) => {
          const urlResgate = await signedResgateFotoUrl(m.resgate_foto_path)
          if (signal?.aborted) return
          if (urlResgate) resgateUrls[m.id] = urlResgate

          const animal = await getAnimalById(m.animal_id)
          if (signal?.aborted) return
          if (animal?.foto_url) {
            const urlPet = await getPetPhotoSignedUrl(animal.foto_url)
            if (urlPet) petUrls[m.id] = urlPet
          }
        }),
      )

      if (!signal?.aborted) {
        setFotosResgate(resgateUrls)
        setFotosPet(petUrls)
      }
    } catch (err) {
      if (signal?.aborted) return
      setError(err instanceof Error ? err.message : 'Erro ao listar matches')
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const ac = new AbortController()
    void carregar(ac.signal)
    return () => ac.abort()
  }, [carregar])

  async function handleStatus(
    id: string,
    status: 'confirmado_tutor' | 'descartado',
  ) {
    setActionId(id)
    setError(null)
    try {
      await atualizarStatusMatch(id, status)
      await carregar()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao atualizar')
    } finally {
      setActionId(null)
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <TutorBackLink to="/tutor">Meus pets</TutorBackLink>
        <h1 className="mt-3 font-display text-[27px] font-extrabold text-brand-dark">
          Possíveis matches
        </h1>
        <p className="mt-1.5 text-sm text-gray-500">
          Sugestões da IA com score de confiança. Confirme ou descarte — nenhum
          reencontro é automático (Art. 4.1).
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-gray-500">Carregando…</p>
      ) : matches.length === 0 ? (
        <p className="text-gray-500">
          Nenhum match sugerido no momento. Quando um resgate parecer compatível
          com uma ocorrência aberta, ele aparece aqui.
        </p>
      ) : (
        <ul className="space-y-5">
          {matches.map((m) => (
            <li key={m.id}>
              <Card className="space-y-4 p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h2 className="font-display text-lg font-bold text-brand-dark">
                    {m.animal_nome}
                  </h2>
                  <Badge variant={scoreBadgeVariant(Number(m.score))}>
                    {Number(m.score).toFixed(0)}% de compatibilidade
                  </Badge>
                </div>

                <div className="flex gap-4">
                  <MatchPhoto
                    src={fotosPet[m.id] ?? null}
                    label="Seu pet"
                    alt={`Foto de ${m.animal_nome}`}
                  />
                  <MatchPhoto
                    src={fotosResgate[m.id] ?? null}
                    label="Encontrado"
                    alt="Foto do resgate"
                  />
                </div>

                <p className="text-sm text-gray-500">
                  {[m.especie_estimada, m.porte_estimado, m.cor_estimada, m.raca_estimada]
                    .filter(Boolean)
                    .join(' · ') || 'Características estimadas indisponíveis'}
                </p>
                {m.regiao_aproximada && (
                  <p className="text-sm text-gray-400">
                    Região: {m.regiao_aproximada}
                  </p>
                )}
                {m.resgate_descricao && (
                  <p className="text-sm text-gray-500">{m.resgate_descricao}</p>
                )}

                <div className="flex flex-wrap gap-3 pt-1">
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    disabled={actionId === m.id}
                    onClick={() => void handleStatus(m.id, 'confirmado_tutor')}
                  >
                    Confirmar reencontro
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={actionId === m.id}
                    onClick={() => void handleStatus(m.id, 'descartado')}
                  >
                    Descartar
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

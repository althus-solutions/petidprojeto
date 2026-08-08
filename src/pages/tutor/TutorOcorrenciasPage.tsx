import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { OcorrenciasMap } from '@/components/ocorrencias/OcorrenciasMap'
import { TutorBackLink } from '@/components/tutor/TutorBackLink'
import { Badge } from '@/components/ui/Badge'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { PawIcon } from '@/components/ui/PawIcon'
import { useAuth } from '@/contexts/AuthContext'
import { listOcorrenciasAbertasTutor } from '@/lib/ocorrencias'
import { getPetPhotoSignedUrl, listAnimaisByTutor } from '@/lib/pets'
import type { OcorrenciaAbertaMapa } from '@/types/ocorrencia'
import type { Animal } from '@/types/pet'

function OcorrenciaCard({
  item,
  selected,
  onSelect,
}: {
  item: OcorrenciaAbertaMapa
  selected: boolean
  onSelect: () => void
}) {
  const [fotoUrl, setFotoUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!item.animal_foto_path) return
    void getPetPhotoSignedUrl(item.animal_foto_path).then(setFotoUrl)
  }, [item.animal_foto_path])

  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        'flex w-full items-center gap-4 rounded-card border bg-white p-5 text-left shadow-card transition-[transform,box-shadow,border-color] duration-150 hover:-translate-y-0.5 hover:shadow-soft',
        selected
          ? 'border-brand-500 ring-4 ring-brand-100'
          : 'border-surface-border',
      ].join(' ')}
    >
      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-brand-50 text-brand-500">
        {fotoUrl ? (
          <img
            src={fotoUrl}
            alt={item.animal_nome}
            className="h-full w-full object-cover"
          />
        ) : (
          <PawIcon className="h-7 w-7" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-base font-bold text-brand-dark">{item.animal_nome}</h3>
        <p className="mt-0.5 text-[13px] text-gray-500">
          {[item.animal_especie, item.endereco_aproximado]
            .filter(Boolean)
            .join(' · ') || 'Sem endereço informado'}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge>Aberta</Badge>
          <Badge variant={item.localizado ? 'success' : 'warning'}>
            {item.localizado ? 'Localizado' : 'Não localizado'}
          </Badge>
        </div>
        <p className="mt-1.5 text-[11.5px] text-gray-400">
          perdido em{' '}
          {new Date(item.data_perda + 'T12:00:00').toLocaleDateString('pt-BR')}
        </p>
      </div>
    </button>
  )
}

export function TutorOcorrenciasPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [ocorrencias, setOcorrencias] = useState<OcorrenciaAbertaMapa[]>([])
  const [petsDisponiveis, setPetsDisponiveis] = useState<Animal[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      if (!user?.tutor?.id) {
        setError('Perfil de tutor não encontrado.')
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      try {
        const [lista, pets] = await Promise.all([
          listOcorrenciasAbertasTutor(),
          listAnimaisByTutor(user.tutor.id),
        ])
        setOcorrencias(lista)
        if (lista[0]) setSelectedId(lista[0].id)

        const abertos = new Set(lista.map((o) => o.animal_id))
        setPetsDisponiveis(pets.filter((p) => !abertos.has(p.id)))
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Erro ao carregar ocorrências. Aplique a migration 016 se ainda não estiver no banco.',
        )
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [user])

  return (
    <section className="mx-auto max-w-[900px] space-y-6">
      <TutorBackLink to="/tutor">Voltar para meus pets</TutorBackLink>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-[25px] font-extrabold text-brand-dark">
            Ocorrências de perda
          </h1>
          <p className="mt-1.5 max-w-xl text-sm text-gray-500">
            Abra uma ocorrência quando o pet se perder — só assim a leitura da
            tag notifica você. O mapa mostra o ponto da perda e, se a tag for
            lida com localização, o último ponto conhecido.
          </p>
        </div>
        {petsDisponiveis.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {petsDisponiveis.slice(0, 3).map((pet) => (
              <Button
                key={pet.id}
                type="button"
                variant="primary"
                size="sm"
                onClick={() => navigate(`/tutor/pets/${pet.id}/perdido`)}
              >
                Abrir ocorrência — {pet.nome}
              </Button>
            ))}
            {petsDisponiveis.length > 3 && (
              <ButtonLink to="/tutor" variant="outline" size="sm">
                Ver todos os pets
              </ButtonLink>
            )}
          </div>
        )}
      </div>

      {loading && <p className="text-sm text-gray-500">Carregando…</p>}
      {error && (
        <p className="rounded-[14px] bg-brand-50 px-4 py-3 text-sm text-brand-700">
          {error}
        </p>
      )}

      {!loading && !error && (
        <>
          <Card className="overflow-hidden p-0 shadow-soft">
            <div className="border-b border-surface-border px-5 py-3.5 sm:px-6">
              <h2 className="font-display text-[15px] font-extrabold text-brand-dark">
                Mapa das ocorrências abertas
              </h2>
              <p className="mt-0.5 text-[12.5px] text-gray-500">
                Marcador roxo = local da perda · círculo verde = localizado via
                tag
              </p>
            </div>
            {ocorrencias.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm text-gray-500">
                Nenhuma ocorrência aberta. Abra uma pelo pet correspondente para
                habilitar notificações da tag.
              </div>
            ) : (
              <OcorrenciasMap
                ocorrencias={ocorrencias}
                selectedId={selectedId}
              />
            )}
          </Card>

          <div>
            <h2 className="mb-3 font-display text-base font-extrabold text-brand-dark">
              Ocorrências abertas
            </h2>
            {ocorrencias.length === 0 ? (
              <div className="rounded-card border-2 border-dashed border-surface-border bg-white p-10 text-center">
                <p className="text-gray-500">
                  Quando você abrir uma ocorrência, ela aparece aqui.
                </p>
                {petsDisponiveis[0] && (
                  <ButtonLink
                    to={`/tutor/pets/${petsDisponiveis[0].id}/perdido`}
                    variant="primary"
                    size="sm"
                    className="mt-4"
                  >
                    Abrir primeira ocorrência
                  </ButtonLink>
                )}
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {ocorrencias.map((item) => (
                  <div key={item.id} className="space-y-2">
                    <OcorrenciaCard
                      item={item}
                      selected={selectedId === item.id}
                      onSelect={() => setSelectedId(item.id)}
                    />
                    <Link
                      to={`/tutor/pets/${item.animal_id}`}
                      className="inline-flex text-[12.5px] font-semibold text-brand-500 hover:underline"
                    >
                      Ver pet →
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  )
}

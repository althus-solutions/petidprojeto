import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { TagSolicitacaoPanel } from '@/components/pets/TagSolicitacaoPanel'
import { TutorBackLink } from '@/components/tutor/TutorBackLink'
import { Badge } from '@/components/ui/Badge'
import { ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { PawIcon } from '@/components/ui/PawIcon'
import { useAuth } from '@/contexts/AuthContext'
import { listOcorrenciasByAnimal } from '@/lib/ocorrencias'
import { getAnimalById, getPetPhotoSignedUrl } from '@/lib/pets'
import type { OcorrenciaPerdido } from '@/types/ocorrencia'
import { labelTagStatus, type Animal } from '@/types/pet'

export function PetDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const [animal, setAnimal] = useState<Animal | null>(null)
  const [ocorrencias, setOcorrencias] = useState<OcorrenciaPerdido[]>([])
  const [fotoUrl, setFotoUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return

    void getAnimalById(id)
      .then((data) => {
        if (!data) {
          setError('Pet não encontrado')
          return
        }
        if (user?.tutor?.id && data.tutor_id !== user.tutor.id) {
          setError('Você não tem permissão para ver este pet')
          return
        }
        setAnimal(data)
        if (data.foto_url) {
          void getPetPhotoSignedUrl(data.foto_url).then(setFotoUrl)
        }
        void listOcorrenciasByAnimal(data.id).then(setOcorrencias)
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Erro ao carregar pet'),
      )
      .finally(() => setLoading(false))
  }, [id, user?.tutor?.id])

  if (loading) {
    return <p className="text-sm text-gray-500">Carregando…</p>
  }

  if (error || !animal) {
    return (
      <section className="space-y-4">
        <p className="text-sm text-red-600">{error ?? 'Pet não encontrado'}</p>
        <TutorBackLink to="/tutor">Voltar</TutorBackLink>
      </section>
    )
  }

  return (
    <section className="space-y-6">
      <TutorBackLink to="/tutor">Voltar para meus pets</TutorBackLink>

      <Card>
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          <div className="mx-auto flex aspect-[4/5] w-full max-w-[240px] shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-b from-brand-50 to-brand-100/60 text-brand-500 sm:mx-0 sm:w-52">
            {fotoUrl ? (
              <img
                src={fotoUrl}
                alt={animal.nome}
                className="h-full w-full object-contain object-center"
              />
            ) : (
              <PawIcon className="h-14 w-14" />
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h1 className="font-display text-2xl font-extrabold text-brand-dark">
                    {animal.nome}
                  </h1>
                  {animal.especie && (
                    <p className="mt-1 text-sm text-gray-500">
                      {animal.especie}
                      {animal.raca ? ` · ${animal.raca}` : ''}
                    </p>
                  )}
                  <div className="mt-2">
                    {(() => {
                      const tag = labelTagStatus(
                        animal.tag_status ??
                          (animal.qr_payload ? 'registrada' : 'nao_solicitada'),
                      )
                      return <Badge variant={tag.variant}>{tag.label}</Badge>
                    })()}
                  </div>
                </div>
                <ButtonLink
                  to={`/tutor/pets/${animal.id}/editar`}
                  variant="outline"
                  size="sm"
                >
                  Editar pet
                </ButtonLink>
              </div>
            </div>
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              {animal.porte && (
                <>
                  <dt className="font-bold text-brand-dark">Porte</dt>
                  <dd className="text-gray-500">{animal.porte}</dd>
                </>
              )}
              {animal.cor && (
                <>
                  <dt className="font-bold text-brand-dark">Cor</dt>
                  <dd className="text-gray-500">{animal.cor}</dd>
                </>
              )}
              {animal.microchip && (
                <>
                  <dt className="font-bold text-brand-dark">Microchip</dt>
                  <dd className="font-mono text-gray-500">{animal.microchip}</dd>
                </>
              )}
              {animal.peso != null && (
                <>
                  <dt className="font-bold text-brand-dark">Peso</dt>
                  <dd className="text-gray-500">{animal.peso} kg</dd>
                </>
              )}
            </dl>
            {animal.caracteristicas && (
              <p className="text-sm leading-relaxed text-gray-500">
                {animal.caracteristicas}
              </p>
            )}
          </div>
        </div>
      </Card>

      <TagSolicitacaoPanel animal={animal} onAnimalChange={setAnimal} />

      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-bold text-brand-dark">
            Ocorrências de perda
          </h2>
          {ocorrencias.some((o) => o.status === 'aberta') ? (
            <ButtonLink to="/tutor/ocorrencias" variant="primary" size="sm">
              Ver ocorrência
            </ButtonLink>
          ) : (
            <ButtonLink
              to={`/tutor/pets/${animal.id}/perdido`}
              variant="outline"
              size="sm"
            >
              Reportar perdido
            </ButtonLink>
          )}
        </div>
        {ocorrencias.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhuma ocorrência registrada.</p>
        ) : (
          <ul className="space-y-3">
            {ocorrencias.map((o) => (
              <li
                key={o.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-[14px] border border-surface-border bg-brand-50/50 px-4 py-3 text-sm"
              >
                <span className="text-gray-600">
                  {o.data_perda}
                  {o.endereco_aproximado ? ` · ${o.endereco_aproximado}` : ''}
                </span>
                <span className="font-bold capitalize text-brand-dark">{o.status}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  )
}

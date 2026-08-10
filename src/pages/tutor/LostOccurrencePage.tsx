import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { LostOccurrenceForm } from '@/components/ocorrencias/LostOccurrenceForm'
import { TutorBackLink } from '@/components/tutor/TutorBackLink'
import { ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useAuth } from '@/contexts/AuthContext'
import { listOcorrenciasByAnimal } from '@/lib/ocorrencias'
import { getAnimalById } from '@/lib/pets'
import type { OcorrenciaPerdido } from '@/types/ocorrencia'
import type { Animal } from '@/types/pet'

export function LostOccurrencePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [animal, setAnimal] = useState<Animal | null>(null)
  const [ocorrencias, setOcorrencias] = useState<OcorrenciaPerdido[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) {
      setLoading(false)
      setError('Pet não informado')
      return
    }

    const animalId = id

    async function load() {
      try {
        const pet = await getAnimalById(animalId)
        if (!pet) {
          setError('Pet não encontrado')
          return
        }
        if (user?.tutor?.id && pet.tutor_id !== user.tutor.id) {
          setError('Sem permissão')
          return
        }
        setAnimal(pet)
        const lista = await listOcorrenciasByAnimal(animalId)
        setOcorrencias(lista)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar')
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [id, user?.tutor?.id])

  const temAberta = ocorrencias.some((o) => o.status === 'aberta')

  if (loading) {
    return <p className="text-sm text-gray-500">Carregando…</p>
  }

  if (error || !animal) {
    return (
      <section className="space-y-4">
        <p className="text-sm text-red-600">{error ?? 'Erro'}</p>
        <TutorBackLink to="/tutor">Voltar</TutorBackLink>
      </section>
    )
  }

  return (
    <section className="mx-auto max-w-xl space-y-6">
      <TutorBackLink to={`/tutor/pets/${animal.id}`}>
        Voltar para {animal.nome}
      </TutorBackLink>

      <Card className="p-8">
        <h1 className="font-display text-2xl font-extrabold text-brand-dark">
          Animal perdido
        </h1>

        {temAberta ? (
          <div className="mt-4 space-y-3">
            <div className="rounded-[14px] bg-brand-50 px-4 py-3.5 text-sm leading-relaxed text-brand-700">
              <strong>{animal.nome}</strong> já está com uma ocorrência de perda{' '}
              <strong>aberta</strong>. Acompanhe no mapa ou registre o
              reencontro em Ocorrências quando o pet for encontrado.
            </div>
            <div className="flex flex-wrap gap-2">
              <ButtonLink to="/tutor/ocorrencias" variant="primary" size="sm">
                Ver no mapa de ocorrências
              </ButtonLink>
              <ButtonLink
                to={`/tutor/pets/${animal.id}`}
                variant="outline"
                size="sm"
              >
                Voltar ao pet
              </ButtonLink>
            </div>
          </div>
        ) : (
          <div className="mt-6">
            <LostOccurrenceForm
              animal={animal}
              onSuccess={() => {
                // Vai ao mapa — evita trocar o sucesso pelo aviso de “já existe aberta”
                navigate('/tutor/ocorrencias', { replace: true })
              }}
            />
          </div>
        )}
      </Card>

      {ocorrencias.length > 0 && (
        <Card className="p-5">
          <h2 className="font-display font-bold text-brand-dark">Histórico</h2>
          <ul className="mt-3 space-y-3">
            {ocorrencias.map((o) => (
              <li
                key={o.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-[14px] border border-surface-border bg-brand-50/50 px-4 py-3 text-sm"
              >
                <span className="text-gray-600">
                  {o.data_perda}
                  {o.retroativa ? ' (retroativa)' : ''}
                </span>
                <span className="font-bold capitalize text-brand-dark">{o.status}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </section>
  )
}
